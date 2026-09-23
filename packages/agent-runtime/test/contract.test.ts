import {
  AgentRuntime,
  createAppointmentBriefingWorkflow,
  createExecutionProvider,
} from '../src/index.js';
import type { BriefingResult, ExecutionProvider, RunEvent } from '../src/index.js';
import {
  APPOINTMENT_ID,
  MemoryStore,
  RecordingAudit,
  ScenarioOptions,
  ScriptedTransport,
  SYNTHETIC_CREDENTIAL,
  appointmentOnlyPermissions,
  appointmentSource,
  configFor,
  expiringCredential,
  fullPermissions,
  historySource,
  managedSessionTransport,
  modelToolTransport,
  revokedCredential,
  toolHandlers,
} from './fixtures.js';

const workflow = createAppointmentBriefingWorkflow(async () => [appointmentSource, historySource]);

interface Harness {
  readonly runtime: AgentRuntime<BriefingResult>;
  readonly audit: RecordingAudit;
  readonly store: MemoryStore;
  readonly scripted: ScriptedTransport;
  readonly provider: ExecutionProvider;
}

const build = (
  providerName: string,
  scriptTransport: (options: ScenarioOptions) => ScriptedTransport,
  options: ScenarioOptions = {},
  configOverrides: Parameters<typeof configFor>[2] = {},
  budget = { maxToolCalls: 4 }
): Harness => {
  const scripted = scriptTransport(options);
  const provider = createExecutionProvider(
    configFor(providerName, scripted.transport, { budget, ...configOverrides })
  );
  const audit = new RecordingAudit();
  const store = new MemoryStore();
  let counter = 0;
  const runtime = new AgentRuntime<BriefingResult>({
    provider,
    workflow,
    tools: toolHandlers,
    store,
    audit,
    budget,
    newRunId: () => `run-${(counter += 1)}`,
    now: () => new Date('2026-09-22T00:00:00.000Z'),
  });
  return { runtime, audit, store, scripted, provider };
};

// The same product-level expectations are asserted against two materially
// different wires: a hosted session orchestrator and a stateless model/tool
// endpoint. Only the adapter differs; the workflow, tools and assertions do not.
const wires: [string, (options: ScenarioOptions) => ScriptedTransport][] = [
  ['managed-session', managedSessionTransport],
  ['model-tool', modelToolTransport],
];

describe.each(wires)('execution contract over the %s wire', (providerName, scriptTransport) => {
  it('produces the same source-linked briefing from the same fixture', async () => {
    const { runtime, audit } = build(providerName, scriptTransport);

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.status).toBe('completed');
    expect(record.result).toEqual({
      appointmentId: APPOINTMENT_ID,
      sections: [
        {
          heading: 'Visit',
          state: 'known',
          body: 'Biscuit the fictional tabby: annual wellness visit',
          sources: [appointmentSource],
        },
        {
          heading: 'History',
          state: 'known',
          body: 'twelve months ago, routine',
          sources: [historySource],
        },
      ],
    });
    expect(audit.events.filter((event) => event.type === 'tool-call')).toEqual([
      expect.objectContaining({ tool: 'appointment.read', decision: 'allowed' }),
      expect.objectContaining({ tool: 'patient.history.read', decision: 'allowed' }),
    ]);
  });

  it('keeps the product run id in events and never the provider session', async () => {
    const { runtime, audit, scripted } = build(providerName, scriptTransport);

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.runId).toBe('run-1');
    const serialised = JSON.stringify(audit.events) + JSON.stringify(record);
    expect(serialised).not.toContain('sess-synthetic');
    // The credential travels on the wire and nowhere else.
    expect(serialised).not.toContain(SYNTHETIC_CREDENTIAL);
    expect(JSON.stringify(scripted.seen)).toContain(SYNTHETIC_CREDENTIAL);
  });

  it('denies a tool the actor cannot use and still returns a stated gap', async () => {
    const { runtime, audit } = build(providerName, scriptTransport);

    const record = await runtime.start(
      { appointmentId: APPOINTMENT_ID },
      appointmentOnlyPermissions
    );

    expect(record.status).toBe('completed');
    expect(record.result?.sections[1]).toEqual({
      heading: 'History',
      state: 'unavailable',
      body: null,
      sources: [],
    });
    expect(audit.events).toContainEqual(
      expect.objectContaining({ tool: 'patient.history.read', decision: 'denied' })
    );
  });

  it('denies a tool the workflow never declared', async () => {
    const { runtime, audit } = build(providerName, scriptTransport, {
      injectedTool: 'database.query',
    });

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(audit.events).toContainEqual(
      expect.objectContaining({ tool: 'database.query', decision: 'denied' })
    );
    expect(record.result?.sections[0].state).toBe('unavailable');
  });

  it('rejects output that does not meet the product result contract', async () => {
    const { runtime, audit } = build(providerName, scriptTransport, { malformed: true });

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.status).toBe('failed');
    expect(record.errorCode).toBe('malformed-output');
    expect(audit.events.at(-1)).toEqual(
      expect.objectContaining({ type: 'run-failed', code: 'malformed-output' })
    );
  });

  it('normalises an expired credential', async () => {
    const { runtime } = build(
      providerName,
      scriptTransport,
      {},
      {
        credential: expiringCredential,
      }
    );

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.errorCode).toBe('credential-expired');
  });

  it('normalises a revoked credential', async () => {
    const { runtime } = build(
      providerName,
      scriptTransport,
      {},
      {
        credential: revokedCredential,
      }
    );

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.errorCode).toBe('credential-revoked');
  });

  it('normalises a provider outage', async () => {
    const { runtime } = build(providerName, scriptTransport, {
      transportError: { status: 503, message: 'upstream down' },
    });

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.errorCode).toBe('provider-unavailable');
  });

  it('stops on the tool budget instead of looping', async () => {
    const { runtime, audit } = build(providerName, scriptTransport, {}, {}, { maxToolCalls: 1 });

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.errorCode).toBe('budget-exceeded');
    expect(audit.events.filter((event) => event.type === 'tool-call')).toHaveLength(2);
  });

  it('fails a run whose reported cost exceeds the configured budget', async () => {
    const { runtime } = build(
      providerName,
      scriptTransport,
      { costUsd: 5 },
      {},
      { maxToolCalls: 4, maxCostUsd: 1 }
    );

    const record = await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);

    expect(record.errorCode).toBe('budget-exceeded');
  });

  it('writes a product checkpoint on success and on failure', async () => {
    const good = build(providerName, scriptTransport);
    await good.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    expect(good.store.saved.get('run-1')?.sources).toEqual([appointmentSource, historySource]);

    const bad = build(providerName, scriptTransport, { malformed: true });
    await bad.runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    expect(bad.store.saved.get('run-1')).toEqual(
      expect.objectContaining({ workflowId: 'appointment-briefing' })
    );
  });

  it('emits no further events once a run has finished', async () => {
    const { runtime, audit } = build(providerName, scriptTransport);

    await runtime.start({ appointmentId: APPOINTMENT_ID }, fullPermissions);
    const terminalIndex = audit.events.findIndex(
      (event: RunEvent) => event.type === 'run-completed'
    );

    expect(terminalIndex).toBe(audit.events.length - 1);
  });
});
