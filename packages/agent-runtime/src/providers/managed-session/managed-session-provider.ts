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

// A hosted orchestrator: the provider keeps the conversation, hands back a
// session id, and asks the caller to satisfy tool calls between turns.
const MAX_TURNS = 12;

interface RequiredAction {
  readonly callId: string;
  readonly tool: string;
  readonly arguments: Record<string, unknown>;
}

const readRequiredActions = (value: unknown): RequiredAction[] => {
  if (!Array.isArray(value)) {
    throw new AgentRuntimeError('malformed-output', 'Session requested actions in no list.');
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.call_id !== 'string' || typeof entry.tool !== 'string') {
      throw new AgentRuntimeError('malformed-output', 'Session action has no call id or tool.');
    }
    return {
      callId: entry.call_id,
      tool: entry.tool,
      arguments: isRecord(entry.arguments) ? entry.arguments : {},
    };
  });
};

const readUsage = (value: unknown): ProviderRunOutcome['usage'] => {
  if (!isRecord(value)) {
    return undefined;
  }
  const usage: { inputUnits?: number; outputUnits?: number; costUsd?: number } = {};
  if (typeof value.input_tokens === 'number') {
    usage.inputUnits = value.input_tokens;
  }
  if (typeof value.output_tokens === 'number') {
    usage.outputUnits = value.output_tokens;
  }
  if (typeof value.cost_usd === 'number') {
    usage.costUsd = value.cost_usd;
  }
  return usage;
};

const failureFor = (value: unknown): AgentRuntimeError => {
  const code = isRecord(value) && typeof value.code === 'string' ? value.code : 'unavailable';
  const message =
    isRecord(value) && typeof value.message === 'string' ? value.message : 'Session failed.';
  switch (code) {
    case 'expired_token':
      return new AgentRuntimeError('credential-expired', message);
    case 'revoked_token':
      return new AgentRuntimeError('credential-revoked', message);
    default:
      return new AgentRuntimeError('provider-unavailable', message, true);
  }
};

export function createManagedSessionProvider(config: ExecutionConfig): ExecutionProvider {
  const send = async (
    method: 'DELETE' | 'POST',
    path: string,
    body?: unknown
  ): Promise<unknown> => {
    const token = await resolveCredential(config.credential);
    try {
      return await config.transport({
        method,
        path: `${config.baseUrl}${path}`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body,
      });
    } catch (error) {
      throw normaliseTransportError(error);
    }
  };

  const advance = async (
    sessionId: string,
    body: unknown,
    hooks: ProviderRunHooks
  ): Promise<ProviderRunOutcome> => {
    let payload: unknown = body;

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      if (hooks.shouldStop()) {
        throw new AgentRuntimeError('cancelled', 'Runtime asked the adapter to stop.');
      }

      const response = await send('POST', `/v1/sessions/${sessionId}/advance`, payload);
      if (!isRecord(response) || typeof response.status !== 'string') {
        throw new AgentRuntimeError('malformed-output', 'Session turn had no status.');
      }

      switch (response.status) {
        case 'in_progress':
          hooks.onProgress(typeof response.note === 'string' ? response.note : 'working');
          payload = {};
          break;

        case 'requires_action': {
          const actions = readRequiredActions(response.required_actions);
          const results = [];
          for (const action of actions) {
            hooks.onProgress(`tool:${action.tool}`);
            try {
              const output = await hooks.callTool(action.tool, action.arguments);
              results.push({ call_id: action.callId, output });
            } catch (error) {
              // A refused tool is information for the model, not a crash. The
              // runtime has already audited the denial.
              results.push({
                call_id: action.callId,
                error: error instanceof AgentRuntimeError ? error.code : 'tool-failed',
              });
            }
          }
          payload = { tool_results: results };
          break;
        }

        case 'completed':
          return { output: response.output, usage: readUsage(response.usage) };

        case 'failed':
          throw failureFor(response.error);

        default:
          throw new AgentRuntimeError(
            'malformed-output',
            `Session returned an unrecognised status: ${response.status}.`
          );
      }
    }

    throw new AgentRuntimeError(
      'provider-unavailable',
      `Session did not finish within ${MAX_TURNS} turns.`,
      true
    );
  };

  return {
    name: 'managed-session',

    capabilities(): ProviderCapabilities {
      return {
        provider: 'managed-session',
        supports: [
          'cancellation',
          'progress-events',
          'provider-resume',
          'structured-output',
          'tool-calls',
        ],
      };
    },

    async run(request: ProviderRunRequest, hooks: ProviderRunHooks): Promise<ProviderRunOutcome> {
      const created = await send('POST', '/v1/sessions', {
        model: config.model,
        workflow: request.workflowId,
        instructions: request.instructions,
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.input,
        })),
      });

      if (!isRecord(created) || typeof created.session_id !== 'string') {
        throw new AgentRuntimeError('malformed-output', 'Session creation returned no id.');
      }
      hooks.onProviderSession(created.session_id);

      return advance(created.session_id, { input: request.input }, hooks);
    },

    async resume(
      providerSession: string,
      request: ProviderRunRequest,
      hooks: ProviderRunHooks
    ): Promise<ProviderRunOutcome> {
      hooks.onProviderSession(providerSession);
      return advance(providerSession, { resume: true, input: request.input }, hooks);
    },

    async cancel(providerSession: string): Promise<void> {
      await send('DELETE', `/v1/sessions/${providerSession}`);
    },
  };
}
