// Every failure a product surface can see, whatever the provider was. Adapters
// translate their own wire failures into these codes; nothing vendor-specific
// reaches domain code or persona UI.
export type AgentErrorCode =
  | 'budget-exceeded'
  | 'cancelled'
  | 'capability-unsupported'
  | 'configuration-invalid'
  | 'credential-expired'
  | 'credential-revoked'
  | 'malformed-output'
  | 'permission-denied'
  | 'provider-unavailable'
  | 'unknown-run';

export class AgentRuntimeError extends Error {
  readonly code: AgentErrorCode;
  readonly retryable: boolean;

  constructor(code: AgentErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'AgentRuntimeError';
    this.code = code;
    this.retryable = retryable;
  }
}

export const isAgentRuntimeError = (value: unknown): value is AgentRuntimeError =>
  value instanceof AgentRuntimeError;
