import type { ProviderCapabilities, RunCheckpoint, ToolSchema, UsageReport } from './types.js';

export interface ProviderRunRequest {
  readonly workflowId: string;
  readonly instructions: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly tools: readonly ToolSchema[];
  // Present when the product is restarting a run from its own checkpoint
  // because the provider cannot resume its side.
  readonly checkpoint?: RunCheckpoint;
}

export interface ProviderRunHooks {
  // Progress text only. The runtime decides what reaches the product surface.
  onProgress(step: string): void;
  // The only way an adapter can touch product data. Rejects with an
  // AgentRuntimeError the adapter is expected to hand back to its model.
  callTool(name: string, input: Record<string, unknown>): Promise<unknown>;
  // Where a vendor session identifier goes to die: the runtime keeps it in a
  // private map and never writes it into product state.
  onProviderSession(reference: string): void;
  // True when the runtime wants the adapter to stop: cancellation or a budget
  // the adapter cannot see. The adapter stops; the runtime names the reason.
  shouldStop(): boolean;
}

export interface ProviderRunOutcome {
  // Unvalidated. The runtime validates against the workflow's result contract,
  // so a provider cannot widen what the product accepts.
  readonly output: unknown;
  readonly usage?: UsageReport;
}

// The contract every execution adapter implements. Keep this surface small:
// managed orchestration and plain model/tool inference differ, and neither is
// asked to emulate the other.
export interface ExecutionProvider {
  readonly name: string;

  capabilities(): ProviderCapabilities;

  run(request: ProviderRunRequest, hooks: ProviderRunHooks): Promise<ProviderRunOutcome>;

  cancel(providerSession: string): Promise<void>;

  // Only providers advertising 'provider-resume'. Everything else restarts from
  // the product checkpoint, which is a documented fallback rather than a gap.
  resume?(
    providerSession: string,
    request: ProviderRunRequest,
    hooks: ProviderRunHooks
  ): Promise<ProviderRunOutcome>;
}

// Adapters receive their transport, so contract tests need no network and CI
// needs no paid provider credentials.
export interface ProviderRequest {
  readonly method: 'DELETE' | 'GET' | 'POST';
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface ProviderTransport {
  (request: ProviderRequest): Promise<unknown>;
}

// Credentials are resolved lazily and never held on the config object, so they
// do not land in a log line or an error report by being in scope.
export type CredentialResolver = () => Promise<string>;
