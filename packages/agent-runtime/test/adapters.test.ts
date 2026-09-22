import {
  AgentRuntime,
  createAppointmentBriefingWorkflow,
  createManagedSessionProvider,
  createModelToolProvider,
} from '../src/index.js';
import type {
  BriefingResult,
  ProviderRequest,
  ProviderRunHooks,
  ProviderRunRequest,
} from '../src/index.js';
import {
  APPOINTMENT_ID,
  MemoryStore,
  RecordingAudit,
  appointmentSource,
  configFor,
  fullPermissions,
  historySource,
  managedSessionTransport,
  modelToolTransport,
  toolHandlers,
} from './fixtures.js';

const workflow = createAppointmentBriefingWorkflow(async () => [appointmentSource, historySource]);

const request: ProviderRunRequest = {
  workflowId: workflow.id,
  instructions: workflow.instructions,
  input: { appointmentId: APPOINTMENT_ID },
  tools: workflow.tools,
};

const hooks = (overrides: Partial<ProviderRunHooks> = {}): ProviderRunHooks => ({
  onProgress: () => undefined,
  onProviderSession: () => undefined,
  shouldStop: () => false,
  callTool: async () => ({}),
  ...overrides,
});

const managedWith = (responder: (request: ProviderRequest) => Promise<unknown>) =>
  createManagedSessionProvider(configFor('managed-session', responder));

const modelToolWith = (responder: (request: ProviderRequest) => Promise<unknown>) =>
  createModelToolProvider(configFor('model-tool', responder));

describe('managed session wire', () => {
  it('rejects a session that returns no id', async () => {
    const provider = managedWith(async () => ({ created: true }));

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'malformed-output',
    });
  });

  it('rejects a turn with no status', async () => {
    const provider = managedWith(async (sent) =>
      sent.path.endsWith('/v1/sessions') ? { session_id: 's1' } : { nothing: true }
    );

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'malformed-output',
    });
  });

  it('rejects an unrecognised turn status', async () => {
    const provider = managedWith(async (sent) =>
      sent.path.endsWith('/v1/sessions') ? { session_id: 's1' } : { status: 'thinking-hard' }
    );

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'malformed-output',
      message: expect.stringContaining('thinking-hard'),
    });
  });

  it('rejects required actions that are not a list', async () => {
    const provider = managedWith(async (sent) =>
      sent.path.endsWith('/v1/sessions')
        ? { session_id: 's1' }
        : { status: 'requires_action', required_actions: { tool: 'appointment.read' } }
    );

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'malformed-output',
    });
  });

  it('rejects a required action with no tool', async () => {
    const provider = managedWith(async (sent) =>
      sent.path.endsWith('/v1/sessions')
        ? { session_id: 's1' }
        : { status: 'requires_action', required_actions: [{ call_id: 'c1' }] }
    );

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'malformed-output',
    });
  });

  it.each([
    ['expired_token', 'credential-expired'],
    ['revoked_token', 'credential-revoked'],
    ['quota', 'provider-unavailable'],
    [undefined, 'provider-unavailable'],
  ])('maps a %s session failure onto %s', async (code, expected) => {
    const provider = managedWith(async (sent) =>
      sent.path.endsWith('/v1/sessions')
        ? { session_id: 's1' }
        : { status: 'failed', error: code ? { code, message: 'no' } : undefined }
    );

    await expect(provider.run(request, hooks())).rejects.toMatchObject({ code: expected });
  });

  it('stops when the runtime says stop', async () => {
    const provider = managedWith(async () => ({ session_id: 's1' }));

    await expect(provider.run(request, hooks({ shouldStop: () => true }))).rejects.toMatchObject({
      code: 'cancelled',
    });
  });

  it('gives up rather than looping forever', async () => {
    const provider = managedWith(async (sent) =>
      sent.path.endsWith('/v1/sessions')
        ? { session_id: 's1' }
        : { status: 'in_progress', note: 'still working' }
    );

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'provider-unavailable',
      message: expect.stringContaining('12 turns'),
    });
  });

  it('completes without a usage block', async () => {
    const provider = managedWith(async (sent) =>
      sent.path.endsWith('/v1/sessions')
        ? { session_id: 's1' }
        : { status: 'completed', output: { ok: true } }
    );

    await expect(provider.run(request, hooks())).resolves.toEqual({
      output: { ok: true },
      usage: undefined,
    });
  });

  it('sends a delete when a run is cancelled', async () => {
    const seen: ProviderRequest[] = [];
    const provider = managedWith(async (sent) => {
      seen.push(sent);
      return { ok: true };
    });

    await provider.cancel('s1');

    expect(seen[0]).toEqual(
      expect.objectContaining({
        method: 'DELETE',
        path: expect.stringContaining('/v1/sessions/s1'),
      })
    );
  });
});

describe('model tool wire', () => {
  it('rejects a response with no completion', async () => {
    const provider = modelToolWith(async () => ({ result: 'here' }));

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'malformed-output',
    });
  });

  it('rejects a tool request that names no tool', async () => {
    const provider = modelToolWith(async () => ({ completion: { kind: 'tool_request' } }));

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'malformed-output',
    });
  });

  it('rejects an unrecognised completion kind', async () => {
    const provider = modelToolWith(async () => ({ completion: { kind: 'musing' } }));

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'malformed-output',
      message: expect.stringContaining('musing'),
    });
  });

  it('surfaces a refusal as an unavailable provider', async () => {
    const provider = modelToolWith(async () => ({
      completion: { kind: 'refusal', reason: 'declined' },
    }));

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'provider-unavailable',
      message: 'declined',
    });
  });

  it('surfaces a refusal with no stated reason', async () => {
    const provider = modelToolWith(async () => ({ completion: { kind: 'refusal' } }));

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'provider-unavailable',
    });
  });

  it('completes without a spend block', async () => {
    const provider = modelToolWith(async () => ({
      completion: { kind: 'final', document: { ok: true } },
    }));

    await expect(provider.run(request, hooks())).resolves.toEqual({
      output: { ok: true },
      usage: undefined,
    });
  });

  it('stops when the runtime says stop', async () => {
    const provider = modelToolWith(async () => ({
      completion: { kind: 'final', document: {} },
    }));

    await expect(provider.run(request, hooks({ shouldStop: () => true }))).rejects.toMatchObject({
      code: 'cancelled',
    });
  });

  it('gives up rather than looping forever', async () => {
    const provider = modelToolWith(async () => ({
      completion: { kind: 'tool_request', tool_id: 'appointment.read', fields: {} },
    }));

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'provider-unavailable',
      message: expect.stringContaining('12 turns'),
    });
  });

  it('has nothing to cancel on the provider', async () => {
    const provider = modelToolWith(async () => ({}));

    await expect(provider.cancel()).resolves.toBeUndefined();
  });
});

describe('transport failures', () => {
  it.each([
    [401, 'credential-expired'],
    [403, 'credential-revoked'],
    [500, 'provider-unavailable'],
    [undefined, 'provider-unavailable'],
  ])('maps http %s onto %s', async (status, expected) => {
    const provider = managedWith(async () => {
      const error = new Error('wire failure') as Error & { status?: number };
      error.status = status;
      throw error;
    });

    await expect(provider.run(request, hooks())).rejects.toMatchObject({ code: expected });
  });

  it('maps a thrown non-error onto an unavailable provider', async () => {
    const provider = modelToolWith(async () => {
      throw 'a string, not an error';
    });

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'provider-unavailable',
    });
  });

  it('normalises a credential resolver that fails', async () => {
    const provider = createManagedSessionProvider(
      configFor('managed-session', managedSessionTransport().transport, {
        credential: async () => {
          const error = new Error('vault down') as Error & { status?: number };
          error.status = 500;
          throw error;
        },
      })
    );

    await expect(provider.run(request, hooks())).rejects.toMatchObject({
      code: 'provider-unavailable',
    });
  });
});

describe('runtime guards against a non-conforming adapter', () => {
  const runtimeWith = (
    provider: Parameters<typeof AgentRuntime>[0] extends never ? never : any
  ) => {
    const audit = new RecordingAudit();
    const store = new MemoryStore();
    return {
      audit,
      store,
      runtime: new AgentRuntime<BriefingResult>({
        provider,
        workflow,
        tools: toolHandlers,
        store,
        audit,
        budget: { maxToolCalls: 1 },
        newRunId: () => 'run-1',
        now: () => new Date('2026-09-22T00:00:00.000Z'),
      }),
    };
  };

  it('refuses a completed result from an adapter that ignored the budget', async () => {
    const { runtime } = runtimeWith({
      name: 'ignores-budget',
      capabilities: () => ({ provider: 'ignores-budget', supports: ['tool-calls'] }),
      run: async (_request: ProviderRunRequest, given: ProviderRunHooks) => {
        await given.callTool('appointment.read', {}).catch(() => undefined);
        await given.callTool('patient.history.read', {}).catch(() => undefined);
        return { output: { appointmentId: APPOINTMENT_ID, sections: [] } };
      },
      cancel: async () => undefined,
    });

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.errorCode).toBe('budget-exceeded');
  });

  it('refuses a completed result from an adapter that ignored a cancellation', async () => {
    const built = runtimeWith({
      name: 'ignores-cancel',
      capabilities: () => ({ provider: 'ignores-cancel', supports: ['tool-calls'] }),
      run: async () => ({ output: { appointmentId: APPOINTMENT_ID, sections: [] } }),
      cancel: async () => undefined,
    });
    const started = built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    await built.runtime.cancel('run-1');

    expect((await started).errorCode).toBe('cancelled');
  });

  it('ignores progress reported after a run has finished', async () => {
    let late: ProviderRunHooks | undefined;
    const built = runtimeWith({
      name: 'late-progress',
      capabilities: () => ({ provider: 'late-progress', supports: ['tool-calls'] }),
      run: async (_request: ProviderRunRequest, given: ProviderRunHooks) => {
        late = given;
        return {
          output: {
            appointmentId: APPOINTMENT_ID,
            sections: [{ heading: 'Visit', state: 'unknown', body: null, sources: [] }],
          },
        };
      },
      cancel: async () => undefined,
    });

    await built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    const before = built.audit.events.length;
    late?.onProgress('still talking');

    expect(built.audit.events).toHaveLength(before);
  });

  it('keeps the first provider session when an adapter announces a second', async () => {
    const seen: string[] = [];
    const built = runtimeWith({
      name: 're-announces',
      capabilities: () => ({
        provider: 're-announces',
        supports: ['cancellation', 'tool-calls'],
      }),
      run: async (_request: ProviderRunRequest, given: ProviderRunHooks) => {
        given.onProviderSession('first');
        given.onProviderSession('second');
        return {
          output: {
            appointmentId: APPOINTMENT_ID,
            sections: [{ heading: 'Visit', state: 'unknown', body: null, sources: [] }],
          },
        };
      },
      cancel: async (session: string) => {
        seen.push(session);
      },
    });

    await built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    await built.runtime.cancel('run-1');

    expect(seen).toEqual(['first']);
  });
});
