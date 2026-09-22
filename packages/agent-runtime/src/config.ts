import { AgentRuntimeError } from './errors.js';
import type { AgentCapability } from './types.js';
import type { CredentialResolver, ProviderTransport } from './execution-provider.js';

export interface ExecutionConfig {
  readonly provider: string;
  readonly baseUrl: string;
  readonly model: string;
  // Declared explicitly so an incapable provider is rejected at configuration
  // time rather than halfway through a clinical briefing.
  readonly requiredCapabilities: readonly AgentCapability[];
  // Sending records to a provider is a decision the practice makes once and
  // explicitly. Without it the boundary refuses to build a provider at all.
  readonly dataEgressAcknowledged: boolean;
  readonly budget: { readonly maxToolCalls: number; readonly maxCostUsd?: number };
  readonly credential: CredentialResolver;
  readonly transport: ProviderTransport;
}

const isHttpsOrLocal = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost');
  } catch {
    return false;
  }
};

export function validateExecutionConfig(config: ExecutionConfig): void {
  if (!config.provider.trim()) {
    throw new AgentRuntimeError('configuration-invalid', 'Execution provider is required.');
  }
  if (!isHttpsOrLocal(config.baseUrl)) {
    throw new AgentRuntimeError(
      'configuration-invalid',
      'Execution base URL must be https, or http on localhost for development.'
    );
  }
  if (!config.model.trim()) {
    throw new AgentRuntimeError('configuration-invalid', 'Execution model is required.');
  }
  if (!config.dataEgressAcknowledged) {
    throw new AgentRuntimeError(
      'configuration-invalid',
      'Data egress to this provider has not been acknowledged.'
    );
  }
  if (!Number.isInteger(config.budget.maxToolCalls) || config.budget.maxToolCalls < 1) {
    throw new AgentRuntimeError(
      'configuration-invalid',
      'Budget maxToolCalls must be a positive integer.'
    );
  }
}
