import type {
  ExecutionConfig,
  ProviderRequest,
  RunCheckpoint,
  RunContext,
  RunEvent,
  RunStore,
  SourceReference,
  ToolHandler,
} from '../src/index.js';
import { AgentRuntimeError } from '../src/index.js';

export const APPOINTMENT_ID = 'appt-synthetic-1';

// Obviously synthetic: a fictional practice, a fictional companion, prose that
// could not be mistaken for a record or a credential.
export const appointmentRecord = {
  appointmentId: APPOINTMENT_ID,
  reason: 'annual wellness visit',
  species: 'cat',
  companion: 'Biscuit the fictional tabby',
};

export const historyRecord = {
  lastVisit: 'twelve months ago, routine',
  notes: 'no ongoing treatment recorded for this fictional companion',
};

export const appointmentSource: SourceReference = {
  kind: 'appointment',
  id: APPOINTMENT_ID,
  version: 'v3',
};

export const historySource: SourceReference = {
  kind: 'patient-history',
  id: 'companion-synthetic-1',
  version: 'v7',
};

export const fullPermissions: RunContext = {
  organisationId: 'org-synthetic',
  actorId: 'staff-synthetic',
  permissions: ['appointment:read', 'patient:read'],
};

export const appointmentOnlyPermissions: RunContext = {
  ...fullPermissions,
  permissions: ['appointment:read'],
};

export const toolHandlers: Readonly<Record<string, ToolHandler>> = {
  'appointment.read': async () => ({
    data: appointmentRecord,
    sources: [appointmentSource],
  }),
  'patient.history.read': async () => ({
    data: historyRecord,
    sources: [historySource],
  }),
};

export class RecordingAudit {
  readonly events: RunEvent[] = [];

  record(event: RunEvent): void {
    this.events.push(event);
  }
}

export class MemoryStore implements RunStore {
  readonly saved = new Map<string, RunCheckpoint>();

  async save(checkpoint: RunCheckpoint): Promise<void> {
    this.saved.set(checkpoint.runId, checkpoint);
  }

  async load(runId: string): Promise<RunCheckpoint | undefined> {
    return this.saved.get(runId);
  }
}

// What a scripted model produces once it has the two tool answers. Shared so
// the two wires are the only difference between the adapters under test.
export const briefingDocument = (
  appointmentOk: boolean,
  historyOk: boolean
): Record<string, unknown> => ({
  appointmentId: APPOINTMENT_ID,
  sections: [
    appointmentOk
      ? {
          heading: 'Visit',
          state: 'known',
          body: `${appointmentRecord.companion}: ${appointmentRecord.reason}`,
          sources: [appointmentSource],
        }
      : { heading: 'Visit', state: 'unavailable', body: null, sources: [] },
    historyOk
      ? {
          heading: 'History',
          state: 'known',
          body: historyRecord.lastVisit,
          sources: [historySource],
        }
      : { heading: 'History', state: 'unavailable', body: null, sources: [] },
  ],
});

export interface ScenarioOptions {
  readonly malformed?: boolean;
  readonly costUsd?: number;
  readonly transportError?: { readonly status?: number; readonly message?: string };
  readonly providerFailure?: { readonly code: string; readonly message: string };
  readonly refuse?: boolean;
  readonly injectedTool?: string;
  readonly neverFinish?: boolean;
}

export interface ScriptedTransport {
  readonly transport: (request: ProviderRequest) => Promise<unknown>;
  readonly seen: ProviderRequest[];
  readonly toolOutcomes: string[];
}

const failIfConfigured = (options: ScenarioOptions): void => {
  if (options.transportError) {
    const error = new Error(options.transportError.message ?? 'transport failed') as Error & {
      status?: number;
    };
    error.status = options.transportError.status;
    throw error;
  }
};

// Wire A: a hosted orchestrator with server-side sessions and required actions.
export const managedSessionTransport = (options: ScenarioOptions = {}): ScriptedTransport => {
  const seen: ProviderRequest[] = [];
  const toolOutcomes: string[] = [];
  let step = 0;

  const transport = async (request: ProviderRequest): Promise<unknown> => {
    seen.push(request);
    failIfConfigured(options);

    if (request.path.endsWith('/v1/sessions') && request.method === 'POST') {
      return { session_id: 'sess-synthetic' };
    }
    if (request.method === 'DELETE') {
      return { deleted: true };
    }

    if (options.providerFailure) {
      return {
        status: 'failed',
        error: { code: options.providerFailure.code, message: options.providerFailure.message },
      };
    }

    const body = request.body as Record<string, unknown> | undefined;
    if (body?.resume === true) {
      // A resumed session has to ask for its tool results again; it does not
      // get to assume the ones from the attempt that died.
      step = 0;
      toolOutcomes.length = 0;
    }
    const results = body?.tool_results as { call_id: string; error?: string }[] | undefined;
    if (results) {
      for (const result of results) {
        toolOutcomes.push(
          result.error ? `${result.call_id}:${result.error}` : `${result.call_id}:ok`
        );
      }
    }

    step += 1;
    if (options.neverFinish) {
      return { status: 'in_progress', note: 'still working' };
    }

    switch (step) {
      case 1:
        return {
          status: 'requires_action',
          required_actions: [
            {
              call_id: 'appointment.read',
              tool: options.injectedTool ?? 'appointment.read',
              arguments: { appointmentId: APPOINTMENT_ID },
            },
          ],
        };
      case 2:
        return { status: 'in_progress', note: 'reading history' };
      case 3:
        return {
          status: 'requires_action',
          required_actions: [
            {
              call_id: 'patient.history.read',
              tool: 'patient.history.read',
              arguments: { appointmentId: APPOINTMENT_ID },
            },
          ],
        };
      default:
        return {
          status: 'completed',
          output: options.malformed
            ? { appointmentId: APPOINTMENT_ID, sections: [{ heading: '', state: 'known' }] }
            : briefingDocument(
                toolOutcomes.includes('appointment.read:ok'),
                toolOutcomes.includes('patient.history.read:ok')
              ),
          usage: { input_tokens: 120, output_tokens: 80, cost_usd: options.costUsd ?? 0.01 },
        };
    }
  };

  return { transport, seen, toolOutcomes };
};

// Wire B: stateless generation. No session id, no role-tagged messages, the
// caller carries the transcript and the provider cannot resume.
export const modelToolTransport = (options: ScenarioOptions = {}): ScriptedTransport => {
  const seen: ProviderRequest[] = [];
  const toolOutcomes: string[] = [];

  const transport = async (request: ProviderRequest): Promise<unknown> => {
    seen.push(request);
    failIfConfigured(options);

    if (options.refuse) {
      return { completion: { kind: 'refusal', reason: 'model declined' } };
    }
    if (options.providerFailure) {
      const error = new Error(options.providerFailure.message) as Error & { status?: number };
      error.status = options.providerFailure.code === 'expired_token' ? 401 : 403;
      throw error;
    }

    const body = request.body as { transcript?: { from: string; text: string }[] };
    const transcript = body.transcript ?? [];
    if (transcript.length === 1 && transcript[0].text.startsWith('resumed:')) {
      // Restarted from the product checkpoint: nothing of the previous attempt
      // survives on this side, so the tools are requested again.
      toolOutcomes.length = 0;
    }
    for (const entry of transcript.slice(toolOutcomes.length)) {
      const [tool, rest] = entry.text.includes('!')
        ? [entry.text.split('!')[0], entry.text.split('!')[1]]
        : [entry.text.split('=')[0], 'ok'];
      toolOutcomes.push(`${tool}:${rest}`);
    }

    if (options.neverFinish) {
      return {
        completion: {
          kind: 'tool_request',
          tool_id: 'appointment.read',
          fields: { appointmentId: APPOINTMENT_ID },
        },
      };
    }

    const asked = (name: string): boolean =>
      toolOutcomes.some((outcome) => outcome.startsWith(`${name}:`));

    if (!asked('appointment.read') && !asked(options.injectedTool ?? '')) {
      return {
        completion: {
          kind: 'tool_request',
          tool_id: options.injectedTool ?? 'appointment.read',
          fields: { appointmentId: APPOINTMENT_ID },
        },
      };
    }
    if (!asked('patient.history.read')) {
      return {
        completion: {
          kind: 'tool_request',
          tool_id: 'patient.history.read',
          fields: { appointmentId: APPOINTMENT_ID },
        },
      };
    }

    return {
      completion: {
        kind: 'final',
        document: options.malformed
          ? { appointmentId: APPOINTMENT_ID, sections: [{ heading: '', state: 'known' }] }
          : briefingDocument(
              toolOutcomes.includes('appointment.read:ok'),
              toolOutcomes.includes('patient.history.read:ok')
            ),
      },
      spend: { units: 80, usd: options.costUsd ?? 0.01 },
    };
  };

  return { transport, seen, toolOutcomes };
};

// Deliberately prose rather than a token shape. A quoted value on a line with a
// credential keyword is what the secret scanners look for, and a fixture must
// not be the thing they find.
export const SYNTHETIC_CREDENTIAL = 'a fictional stand-in, not a provider token';

export const configFor = (
  provider: string,
  transport: (request: ProviderRequest) => Promise<unknown>,
  overrides: Partial<ExecutionConfig> = {}
): ExecutionConfig => ({
  provider,
  baseUrl: 'https://execution.invalid',
  model: 'synthetic-model-1',
  requiredCapabilities: ['tool-calls', 'structured-output'],
  dataEgressAcknowledged: true,
  budget: { maxToolCalls: 4 },
  credential: async () => SYNTHETIC_CREDENTIAL,
  transport,
  ...overrides,
});

export const expiringCredential = async (): Promise<string> => {
  const error = new Error('credential expired') as Error & { status?: number };
  error.status = 401;
  throw error;
};

export const revokedCredential = async (): Promise<string> => {
  const error = new Error('credential revoked') as Error & { status?: number };
  error.status = 403;
  throw error;
};

export const assertRuntimeError = (error: unknown): AgentRuntimeError => {
  if (!(error instanceof AgentRuntimeError)) {
    throw new Error(`expected an AgentRuntimeError, received ${String(error)}`);
  }
  return error;
};
