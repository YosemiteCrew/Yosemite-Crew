import { AgentRuntimeError, isAgentRuntimeError } from './errors.js';
import type {
  ExecutionProvider,
  ProviderRunHooks,
  ProviderRunOutcome,
  ProviderRunRequest,
} from './execution-provider.js';
import type { ToolHandler, WorkflowDefinition } from './workflow.js';
import type {
  RunCheckpoint,
  RunContext,
  RunEvent,
  RunId,
  RunRecord,
  RunStatus,
  SourceReference,
  UsageReport,
} from './types.js';

export interface RunStore {
  save(checkpoint: RunCheckpoint): Promise<void>;
  load(runId: RunId): Promise<RunCheckpoint | undefined>;
}

export interface AuditSink {
  record(event: RunEvent): void;
}

export interface AgentRuntimeDeps<TResult> {
  readonly provider: ExecutionProvider;
  readonly workflow: WorkflowDefinition<TResult>;
  readonly tools: Readonly<Record<string, ToolHandler>>;
  readonly store: RunStore;
  readonly audit: AuditSink;
  readonly budget: { readonly maxToolCalls: number; readonly maxCostUsd?: number };
  readonly newRunId: () => RunId;
  readonly now: () => Date;
}

interface RunState {
  status: RunStatus;
  providerSession?: string;
  cancelled: boolean;
  toolCalls: number;
  budgetStopped: boolean;
  sources: SourceReference[];
  steps: string[];
}

export class AgentRuntime<TResult> {
  private readonly deps: AgentRuntimeDeps<TResult>;
  private readonly runs = new Map<RunId, RunState>();

  constructor(deps: AgentRuntimeDeps<TResult>) {
    this.deps = deps;
  }

  async start(
    input: Readonly<Record<string, unknown>>,
    ctx: RunContext
  ): Promise<RunRecord<TResult>> {
    const runId = this.deps.newRunId();
    const state: RunState = {
      status: 'running',
      cancelled: false,
      toolCalls: 0,
      budgetStopped: false,
      sources: [],
      steps: [],
    };
    this.runs.set(runId, state);
    this.emit({ type: 'run-started', runId, at: this.at() });

    return this.execute(runId, state, ctx, {
      workflowId: this.deps.workflow.id,
      instructions: this.deps.workflow.instructions,
      input,
      tools: this.deps.workflow.tools,
    });
  }

  // Cancellation is product-level: the run stops whether or not the provider
  // has a cancel endpoint, and a provider that has one is told as well.
  async cancel(runId: RunId): Promise<void> {
    const state = this.runs.get(runId);
    if (!state) {
      throw new AgentRuntimeError('unknown-run', `No run ${runId}.`);
    }
    state.cancelled = true;
    const session = state.providerSession;
    if (session && this.supports('cancellation')) {
      await this.deps.provider.cancel(session);
    }
  }

  // Resume where the provider can, restart from the product checkpoint where it
  // cannot. Either way the sources and the caller's permissions are re-read.
  async resume(runId: RunId, ctx: RunContext): Promise<RunRecord<TResult>> {
    const checkpoint = await this.deps.store.load(runId);
    if (!checkpoint) {
      throw new AgentRuntimeError('unknown-run', `No checkpoint for run ${runId}.`);
    }

    const sources = await this.deps.workflow.refreshSources(checkpoint.input, ctx);
    const refreshed: RunCheckpoint = { ...checkpoint, sources: [...sources] };
    await this.deps.store.save(refreshed);

    const state: RunState = {
      status: 'running',
      providerSession: this.runs.get(runId)?.providerSession,
      cancelled: false,
      toolCalls: 0,
      budgetStopped: false,
      sources: [...sources],
      steps: [...checkpoint.completedSteps],
    };
    this.runs.set(runId, state);
    this.emit({ type: 'step', runId, at: this.at(), step: 'sources-refreshed' });

    const request: ProviderRunRequest = {
      workflowId: this.deps.workflow.id,
      instructions: this.deps.workflow.instructions,
      input: checkpoint.input,
      tools: this.deps.workflow.tools,
      checkpoint: refreshed,
    };

    const session = state.providerSession;
    const providerResume =
      session && this.supports('provider-resume') && this.deps.provider.resume
        ? (hooks: ProviderRunHooks) => this.deps.provider.resume!(session, request, hooks)
        : undefined;

    return this.execute(runId, state, ctx, request, providerResume);
  }

  private async execute(
    runId: RunId,
    state: RunState,
    ctx: RunContext,
    request: ProviderRunRequest,
    providerResume?: (hooks: ProviderRunHooks) => Promise<ProviderRunOutcome>
  ): Promise<RunRecord<TResult>> {
    const hooks = this.hooksFor(runId, state, ctx);

    try {
      const outcome = await this.invokeProvider(hooks, request, providerResume);
      return await this.acceptOutcome(runId, state, request, outcome);
    } catch (error) {
      return this.failRun(runId, state, request, error);
    }
  }

  private invokeProvider(
    hooks: ProviderRunHooks,
    request: ProviderRunRequest,
    providerResume?: (hooks: ProviderRunHooks) => Promise<ProviderRunOutcome>
  ): Promise<ProviderRunOutcome> {
    return providerResume ? providerResume(hooks) : this.deps.provider.run(request, hooks);
  }

  private async acceptOutcome(
    runId: RunId,
    state: RunState,
    request: ProviderRunRequest,
    outcome: ProviderRunOutcome
  ): Promise<RunRecord<TResult>> {
    this.assertOutcomeAllowed(runId, state, outcome.usage);
    const result = this.deps.workflow.validateResult(outcome.output);
    return this.completeRun(runId, state, request, result);
  }

  /**
   * What a provider returned is not automatically what the product accepts.
   * These are the reasons a finished call is still not a completed run, and
   * they are checked here rather than inside an adapter that cannot see them.
   */
  private assertOutcomeAllowed(runId: RunId, state: RunState, usage?: UsageReport): void {
    if (state.budgetStopped) {
      throw new AgentRuntimeError(
        'budget-exceeded',
        `Run ${runId} exceeded ${this.deps.budget.maxToolCalls} tool calls.`
      );
    }
    if (state.cancelled) {
      throw new AgentRuntimeError('cancelled', `Run ${runId} was cancelled.`);
    }

    const maxCost = this.deps.budget.maxCostUsd;
    const cost = usage?.costUsd;
    if (maxCost !== undefined && cost !== undefined && cost > maxCost) {
      throw new AgentRuntimeError(
        'budget-exceeded',
        `Run ${runId} reported ${cost} against a ${maxCost} budget.`
      );
    }
  }

  private async completeRun(
    runId: RunId,
    state: RunState,
    request: ProviderRunRequest,
    result: TResult
  ): Promise<RunRecord<TResult>> {
    await this.saveCheckpoint(runId, state, request);
    state.status = 'completed';
    this.emit({ type: 'run-completed', runId, at: this.at() });
    return { runId, workflowId: request.workflowId, status: 'completed', result };
  }

  private async failRun(
    runId: RunId,
    state: RunState,
    request: ProviderRunRequest,
    error: unknown
  ): Promise<RunRecord<TResult>> {
    const failure = this.stopReason(state, this.normalise(error));
    state.status = failure.code === 'cancelled' ? 'cancelled' : 'failed';
    // A checkpoint is written on failure too: the product, not the vendor, owns
    // what a later attempt starts from.
    await this.saveCheckpoint(runId, state, request);
    this.emit(
      failure.code === 'cancelled'
        ? { type: 'run-cancelled', runId, at: this.at() }
        : { type: 'run-failed', runId, at: this.at(), code: failure.code }
    );
    return {
      runId,
      workflowId: request.workflowId,
      status: state.status,
      errorCode: failure.code,
    };
  }

  private saveCheckpoint(
    runId: RunId,
    state: RunState,
    request: ProviderRunRequest
  ): Promise<void> {
    return this.deps.store.save({
      runId,
      workflowId: request.workflowId,
      input: request.input,
      sources: state.sources,
      completedSteps: state.steps,
    });
  }

  private hooksFor(runId: RunId, state: RunState, ctx: RunContext): ProviderRunHooks {
    return {
      onProgress: (step: string) => {
        if (state.status !== 'running') {
          return;
        }
        state.steps.push(step);
        this.emit({ type: 'step', runId, at: this.at(), step });
      },

      onProviderSession: (reference: string) => {
        // First registration wins. A provider re-announcing its session must not
        // be able to repoint a product run at another vendor conversation.
        state.providerSession ??= reference;
      },

      shouldStop: () => state.cancelled || state.budgetStopped,

      callTool: async (name: string, input: Record<string, unknown>) => {
        if (state.cancelled) {
          throw new AgentRuntimeError('cancelled', `Run ${runId} was cancelled.`);
        }
        if (state.toolCalls >= this.deps.budget.maxToolCalls) {
          state.budgetStopped = true;
          this.emit({ type: 'tool-call', runId, at: this.at(), tool: name, decision: 'denied' });
          throw new AgentRuntimeError(
            'budget-exceeded',
            `Run ${runId} exceeded ${this.deps.budget.maxToolCalls} tool calls.`
          );
        }

        const schema = this.deps.workflow.tools.find((tool) => tool.name === name);
        const handler = schema ? this.deps.tools[name] : undefined;
        if (!schema || !handler || !ctx.permissions.includes(schema.requiredPermission)) {
          this.emit({ type: 'tool-call', runId, at: this.at(), tool: name, decision: 'denied' });
          throw new AgentRuntimeError(
            'permission-denied',
            `Tool ${name} is not available to this actor.`
          );
        }

        state.toolCalls += 1;
        this.emit({ type: 'tool-call', runId, at: this.at(), tool: name, decision: 'allowed' });
        const { data, sources } = await handler(input, ctx);
        for (const source of sources) {
          state.sources.push(source);
        }
        return data;
      },
    };
  }

  private supports(capability: 'cancellation' | 'provider-resume'): boolean {
    return this.deps.provider.capabilities().supports.includes(capability);
  }

  // An adapter that honours shouldStop() cannot know why it was told to stop.
  // The runtime does, so it names the reason.
  private stopReason(state: RunState, failure: AgentRuntimeError): AgentRuntimeError {
    if (failure.code === 'cancelled' && state.budgetStopped) {
      return new AgentRuntimeError(
        'budget-exceeded',
        `Run exceeded ${this.deps.budget.maxToolCalls} tool calls.`
      );
    }
    return failure;
  }

  private normalise(error: unknown): AgentRuntimeError {
    if (isAgentRuntimeError(error)) {
      return error;
    }
    // An adapter that throws something unmapped is treated as an outage, never
    // as a reason to try a different provider.
    return new AgentRuntimeError(
      'provider-unavailable',
      error instanceof Error ? error.message : 'Execution provider failed.',
      true
    );
  }

  private emit(event: RunEvent): void {
    this.deps.audit.record(event);
  }

  private at(): string {
    return this.deps.now().toISOString();
  }
}
