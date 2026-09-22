import {
  AgentRuntime,
  createAppointmentBriefingWorkflow,
  createExecutionProvider,
} from '../src/index.js';
import type {
  BriefingResult,
  ExecutionConfig,
  RunContext,
  SourceReference,
  ToolHandler,
} from '../src/index.js';
import {
  APPOINTMENT_ID,
  MemoryStore,
  RecordingAudit,
  ScriptedTransport,
  appointmentSource,
  configFor,
  fullPermissions,
  historySource,
  managedSessionTransport,
  modelToolTransport,
  toolHandlers,
} from './fixtures.js';

const buildRuntime = (
  providerName: string,
  scripted: ScriptedTransport,
  options: {
    sources?: readonly SourceReference[];
    tools?: Readonly<Record<string, ToolHandler>>;
    configOverrides?: Partial<ExecutionConfig>;
  } = {}
) => {
  const workflow = createAppointmentBriefingWorkflow(async () => [
    ...(options.sources ?? [appointmentSource, historySource]),
  ]);
  const provider = createExecutionProvider(
    configFor(providerName, scripted.transport, options.configOverrides)
  );
  const audit = new RecordingAudit();
  const store = new MemoryStore();
  const runtime = new AgentRuntime<BriefingResult>({
    provider,
    workflow,
    tools: options.tools ?? toolHandlers,
    store,
    audit,
    budget: { maxToolCalls: 4 },
    newRunId: () => 'run-1',
    now: () => new Date('2026-09-22T00:00:00.000Z'),
  });
  return { runtime, audit, store, provider };
};

describe('provider swap', () => {
  it('selects a different provider from configuration alone and returns the same briefing', async () => {
    const managed = buildRuntime('managed-session', managedSessionTransport());
    const modelTool = buildRuntime('model-tool', modelToolTransport());

    const first = await managed.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    const second = await modelTool.runtime.start(
      { appointmentId: APPOINTMENT_ID },
      fullPermissions
    );

    expect(first.result).toEqual(second.result);
    expect(first.status).toBe('completed');
    expect(second.status).toBe('completed');
    // Same workflow object shape drove both; only the adapter name differs.
    expect(managed.provider.name).not.toBe(modelTool.provider.name);
  });
});

describe('cancellation', () => {
  const cancellingTools = (runtimeRef: {
    current?: AgentRuntime<BriefingResult>;
  }): Readonly<Record<string, ToolHandler>> => ({
    ...toolHandlers,
    'appointment.read': async (input, ctx) => {
      await runtimeRef.current?.cancel('run-1');
      return toolHandlers['appointment.read'](input, ctx);
    },
  });

  it('stops a managed-session run and tells the provider', async () => {
    const scripted = managedSessionTransport();
    const ref: { current?: AgentRuntime<BriefingResult> } = {};
    const built = buildRuntime('managed-session', scripted, { tools: cancellingTools(ref) });
    ref.current = built.runtime;

    const record = await built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.status).toBe('cancelled');
    expect(record.errorCode).toBe('cancelled');
    expect(scripted.seen.some((request) => request.method === 'DELETE')).toBe(true);
    expect(built.audit.events.at(-1)).toEqual(expect.objectContaining({ type: 'run-cancelled' }));
  });

  it('stops a model-tool run even though the provider holds nothing to cancel', async () => {
    const scripted = modelToolTransport();
    const ref: { current?: AgentRuntime<BriefingResult> } = {};
    const built = buildRuntime('model-tool', scripted, { tools: cancellingTools(ref) });
    ref.current = built.runtime;

    const record = await built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.status).toBe('cancelled');
    expect(scripted.seen.every((request) => request.method === 'POST')).toBe(true);
  });

  it('rejects a cancel for a run it does not know', async () => {
    const built = buildRuntime('model-tool', modelToolTransport());

    await expect(built.runtime.cancel('run-absent')).rejects.toMatchObject({
      code: 'unknown-run',
    });
  });
});

describe('resume and restart', () => {
  it('resumes the provider session when the provider supports it', async () => {
    const scripted = managedSessionTransport();
    const built = buildRuntime('managed-session', scripted, {
      configOverrides: { requiredCapabilities: ['provider-resume', 'tool-calls'] },
    });

    await built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    const before = scripted.seen.length;
    const resumed = await built.runtime.resume('run-1', fullPermissions);

    expect(resumed.status).toBe('completed');
    const resumeBodies = scripted.seen
      .slice(before)
      .map((request) => JSON.stringify(request.body ?? {}));
    expect(resumeBodies.some((body) => body.includes('"resume":true'))).toBe(true);
    // No new session: the product run id still points at the first one.
    expect(
      scripted.seen.slice(before).every((request) => !request.path.endsWith('/v1/sessions'))
    ).toBe(true);
  });

  it('restarts from the product checkpoint when the provider cannot resume', async () => {
    const scripted = modelToolTransport();
    const built = buildRuntime('model-tool', scripted);

    await built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    const before = scripted.seen.length;
    const resumed = await built.runtime.resume('run-1', fullPermissions);

    expect(resumed.status).toBe('completed');
    const bodies = scripted.seen.slice(before).map((request) => JSON.stringify(request.body));
    expect(bodies[0]).toContain('resumed:');
  });

  it('refreshes record versions rather than trusting the stored checkpoint', async () => {
    const scripted = managedSessionTransport();
    const built = buildRuntime('managed-session', scripted);
    await built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    expect(built.store.saved.get('run-1')?.sources).toEqual([appointmentSource, historySource]);

    const newer: SourceReference = { ...appointmentSource, version: 'v4' };
    const refreshing = buildRuntime('managed-session', managedSessionTransport(), {
      sources: [newer, historySource],
    });
    await refreshing.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    const resumed = await refreshing.runtime.resume('run-1', fullPermissions);

    expect(resumed.status).toBe('completed');
    expect(refreshing.store.saved.get('run-1')?.sources).toContainEqual(newer);
    expect(refreshing.audit.events).toContainEqual(
      expect.objectContaining({ type: 'step', step: 'sources-refreshed' })
    );
  });

  it('re-reads the caller permissions on resume instead of the stored ones', async () => {
    const scripted = managedSessionTransport();
    const built = buildRuntime('managed-session', scripted);
    await built.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    const narrowed: RunContext = { ...fullPermissions, permissions: ['appointment:read'] };
    const resumed = await built.runtime.resume('run-1', narrowed);

    expect(resumed.result?.sections[1].state).toBe('unavailable');
    expect(built.audit.events).toContainEqual(
      expect.objectContaining({ tool: 'patient.history.read', decision: 'denied' })
    );
  });

  it('rejects a resume for a run with no checkpoint', async () => {
    const built = buildRuntime('model-tool', modelToolTransport());

    await expect(built.runtime.resume('run-absent', fullPermissions)).rejects.toMatchObject({
      code: 'unknown-run',
    });
  });
});
