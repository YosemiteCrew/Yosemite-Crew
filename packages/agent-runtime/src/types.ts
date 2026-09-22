// Product-owned run identifier. Vendor session identifiers never appear here or
// in any event, result or checkpoint the product stores.
export type RunId = string;

export type AgentCapability =
  'cancellation' | 'progress-events' | 'provider-resume' | 'structured-output' | 'tool-calls';

export interface ProviderCapabilities {
  readonly provider: string;
  readonly supports: readonly AgentCapability[];
}

// A tool the product exposes to a run. The schema and the permission it demands
// are product-owned; adapters only translate the shape onto their own wire.
export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  readonly input: Readonly<Record<string, 'boolean' | 'number' | 'string'>>;
  readonly requiredPermission: string;
}

// Where a piece of clinical content came from, including the record version it
// was read at, so a resumed run can tell fresh content from stale.
export interface SourceReference {
  readonly kind: string;
  readonly id: string;
  readonly version: string;
}

// "Unknown", "unavailable" and "not-applicable" are deliberately distinct: an
// absent answer must never read as a clinical negative.
export type SectionState = 'known' | 'not-applicable' | 'unavailable' | 'unknown';

export interface BriefingSection {
  readonly heading: string;
  readonly state: SectionState;
  readonly body: string | null;
  readonly sources: readonly SourceReference[];
}

export interface BriefingResult {
  readonly appointmentId: string;
  readonly sections: readonly BriefingSection[];
}

export type RunStatus = 'cancelled' | 'completed' | 'failed' | 'running';

export type RunEvent =
  | { readonly type: 'run-started'; readonly runId: RunId; readonly at: string }
  | { readonly type: 'step'; readonly runId: RunId; readonly at: string; readonly step: string }
  | {
      readonly type: 'tool-call';
      readonly runId: RunId;
      readonly at: string;
      readonly tool: string;
      readonly decision: 'allowed' | 'denied';
    }
  | { readonly type: 'run-completed'; readonly runId: RunId; readonly at: string }
  | { readonly type: 'run-cancelled'; readonly runId: RunId; readonly at: string }
  | {
      readonly type: 'run-failed';
      readonly runId: RunId;
      readonly at: string;
      readonly code: string;
    };

// What the product keeps so a run can be resumed or restarted without trusting
// a vendor transcript: the inputs, the sources read and the steps finished.
export interface RunCheckpoint {
  readonly runId: RunId;
  readonly workflowId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly sources: readonly SourceReference[];
  readonly completedSteps: readonly string[];
}

export interface RunRecord<TResult = unknown> {
  readonly runId: RunId;
  readonly workflowId: string;
  readonly status: RunStatus;
  readonly result?: TResult;
  readonly errorCode?: string;
}

export interface RunContext {
  readonly organisationId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
}

export interface UsageReport {
  readonly inputUnits?: number;
  readonly outputUnits?: number;
  readonly costUsd?: number;
}
