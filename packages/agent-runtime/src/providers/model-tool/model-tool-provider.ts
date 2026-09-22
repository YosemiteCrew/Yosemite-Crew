import type { ExecutionConfig } from '../../config.js';
import { AgentRuntimeError } from '../../errors.js';
import type {
  ExecutionProvider,
  ProviderRunHooks,
  ProviderRunOutcome,
  ProviderRunRequest,
} from '../../execution-provider.js';
import type { ProviderCapabilities } from '../../types.js';
import { isRecord, normaliseTransportError, resolveCredential } from '../transport-errors.js';

// A deliberately different wire: no sessions, no server-side conversation, no
// role-tagged message array. Each call is one stateless completion and the
// caller carries the transcript, which is why this adapter cannot resume.
const MAX_TURNS = 12;

interface TranscriptEntry {
  readonly from: 'model' | 'product';
  readonly text: string;
}

// The spend block is optional and each field inside it is optional, so it is
// read rather than cast.
const readSpend = (response: Record<string, unknown>): ProviderRunOutcome['usage'] => {
  if (!isRecord(response.spend)) {
    return undefined;
  }
  const { units, usd } = response.spend;
  return {
    ...(typeof units === 'number' ? { outputUnits: units } : {}),
    ...(typeof usd === 'number' ? { costUsd: usd } : {}),
  };
};

// One tool turn. A refused tool is written into the transcript as a refusal the
// model can read, which is why this does not rethrow.
const runToolTurn = async (
  completion: Record<string, unknown>,
  hooks: ProviderRunHooks,
  transcript: TranscriptEntry[]
): Promise<void> => {
  if (typeof completion.tool_id !== 'string') {
    throw new AgentRuntimeError('malformed-output', 'Tool request named no tool.');
  }
  const toolId = completion.tool_id;
  hooks.onProgress(`tool:${toolId}`);
  const fields = isRecord(completion.fields) ? completion.fields : {};
  try {
    const output = await hooks.callTool(toolId, fields);
    transcript.push({ from: 'product', text: `${toolId}=${JSON.stringify(output)}` });
  } catch (error) {
    transcript.push({
      from: 'product',
      text: `${toolId}!${error instanceof AgentRuntimeError ? error.code : 'tool-failed'}`,
    });
  }
};

const openingTranscript = (request: ProviderRunRequest): TranscriptEntry[] =>
  request.checkpoint
    ? // Restarting: tell the model what the product already has, rather than
      // asking the provider to remember it.
      [{ from: 'product', text: `resumed:${request.checkpoint.completedSteps.join(',')}` }]
    : [];

const generationBody = (
  model: string,
  request: ProviderRunRequest,
  transcript: TranscriptEntry[]
): Record<string, unknown> => ({
  model,
  system: request.instructions,
  workflow: request.workflowId,
  subject: request.input,
  transcript,
  tool_catalog: request.tools.map((tool) => ({
    id: tool.name,
    summary: tool.description,
    fields: tool.input,
  })),
});

const readGeneration = (
  value: unknown
): { response: Record<string, unknown>; completion: Record<string, unknown> } => {
  if (!isRecord(value) || !isRecord(value.completion)) {
    throw new AgentRuntimeError('malformed-output', 'Generation returned no completion.');
  }
  return { response: value, completion: value.completion };
};

const handleGeneration = async (
  value: unknown,
  hooks: ProviderRunHooks,
  transcript: TranscriptEntry[]
): Promise<ProviderRunOutcome | undefined> => {
  const { response, completion } = readGeneration(value);
  switch (completion.kind) {
    case 'tool_request':
      await runToolTurn(completion, hooks, transcript);
      return undefined;
    case 'final':
      return { output: completion.document, usage: readSpend(response) };
    case 'refusal':
      throw new AgentRuntimeError(
        'provider-unavailable',
        typeof completion.reason === 'string' ? completion.reason : 'Model refused.'
      );
    default:
      throw new AgentRuntimeError(
        'malformed-output',
        `Generation returned an unrecognised completion: ${String(completion.kind)}.`
      );
  }
};

export function createModelToolProvider(config: ExecutionConfig): ExecutionProvider {
  const generate = async (body: unknown): Promise<unknown> => {
    const token = await resolveCredential(config.credential);
    try {
      return await config.transport({
        method: 'POST',
        path: `${config.baseUrl}/generate`,
        headers: { 'x-api-key': token, accept: 'application/json' },
        body,
      });
    } catch (error) {
      throw normaliseTransportError(error);
    }
  };

  return {
    name: 'model-tool',

    capabilities(): ProviderCapabilities {
      // No provider-resume: there is nothing on the provider to resume. The
      // runtime restarts from its own checkpoint instead.
      return {
        provider: 'model-tool',
        supports: ['cancellation', 'progress-events', 'structured-output', 'tool-calls'],
      };
    },

    async run(request: ProviderRunRequest, hooks: ProviderRunHooks): Promise<ProviderRunOutcome> {
      const transcript = openingTranscript(request);

      for (let turn = 0; turn < MAX_TURNS; turn += 1) {
        if (hooks.shouldStop()) {
          throw new AgentRuntimeError('cancelled', 'Runtime asked the adapter to stop.');
        }

        const outcome = await handleGeneration(
          await generate(generationBody(config.model, request, transcript)),
          hooks,
          transcript
        );
        if (outcome) {
          return outcome;
        }
      }

      throw new AgentRuntimeError(
        'provider-unavailable',
        `Generation did not finish within ${MAX_TURNS} turns.`,
        true
      );
    },

    // Nothing is held on the provider, so there is nothing to cancel remotely.
    // The runtime's own cancellation is what stops the loop.
    async cancel(): Promise<void> {},
  };
}
