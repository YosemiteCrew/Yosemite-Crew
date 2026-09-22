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
      const transcript: TranscriptEntry[] = [];
      if (request.checkpoint) {
        // Restarting: tell the model what the product already has, rather than
        // asking the provider to remember it.
        transcript.push({
          from: 'product',
          text: `resumed:${request.checkpoint.completedSteps.join(',')}`,
        });
      }

      for (let turn = 0; turn < MAX_TURNS; turn += 1) {
        if (hooks.shouldStop()) {
          throw new AgentRuntimeError('cancelled', 'Runtime asked the adapter to stop.');
        }

        const response = await generate({
          model: config.model,
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

        if (!isRecord(response) || !isRecord(response.completion)) {
          throw new AgentRuntimeError('malformed-output', 'Generation returned no completion.');
        }
        const completion = response.completion;

        if (completion.kind === 'tool_request') {
          if (typeof completion.tool_id !== 'string') {
            throw new AgentRuntimeError('malformed-output', 'Tool request named no tool.');
          }
          hooks.onProgress(`tool:${completion.tool_id}`);
          const fields = isRecord(completion.fields) ? completion.fields : {};
          try {
            const output = await hooks.callTool(completion.tool_id, fields);
            transcript.push({
              from: 'product',
              text: `${completion.tool_id}=${JSON.stringify(output)}`,
            });
          } catch (error) {
            transcript.push({
              from: 'product',
              text: `${completion.tool_id}!${
                error instanceof AgentRuntimeError ? error.code : 'tool-failed'
              }`,
            });
          }
          continue;
        }

        if (completion.kind === 'final') {
          const usage = isRecord(response.spend)
            ? {
                ...(typeof response.spend.units === 'number'
                  ? { outputUnits: response.spend.units }
                  : {}),
                ...(typeof response.spend.usd === 'number' ? { costUsd: response.spend.usd } : {}),
              }
            : undefined;
          return { output: completion.document, usage };
        }

        if (completion.kind === 'refusal') {
          throw new AgentRuntimeError(
            'provider-unavailable',
            typeof completion.reason === 'string' ? completion.reason : 'Model refused.'
          );
        }

        throw new AgentRuntimeError(
          'malformed-output',
          `Generation returned an unrecognised completion: ${String(completion.kind)}.`
        );
      }

      throw new AgentRuntimeError(
        'provider-unavailable',
        `Generation did not finish within ${MAX_TURNS} turns.`,
        true
      );
    },

    // Nothing is held on the provider, so there is nothing to cancel remotely.
    // The runtime's own cancellation is what stops the loop.
    async cancel(): Promise<void> {
      return undefined;
    },
  };
}
