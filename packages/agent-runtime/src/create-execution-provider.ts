import type { ExecutionConfig } from './config.js';
import { validateExecutionConfig } from './config.js';
import { AgentRuntimeError } from './errors.js';
import type { ExecutionProvider } from './execution-provider.js';
import { createManagedSessionProvider } from './providers/managed-session/managed-session-provider.js';
import { createModelToolProvider } from './providers/model-tool/model-tool-provider.js';
import type { AgentCapability } from './types.js';

export type ProviderFactory = (config: ExecutionConfig) => ExecutionProvider;

// Adding a provider is a registry entry plus an adapter directory. Domain
// workflows and persona UI do not change.
export const defaultProviderRegistry: Readonly<Record<string, ProviderFactory>> = {
  'managed-session': createManagedSessionProvider,
  'model-tool': createModelToolProvider,
};

export function missingCapabilities(
  provider: ExecutionProvider,
  required: readonly AgentCapability[]
): AgentCapability[] {
  const supported = new Set(provider.capabilities().supports);
  return required.filter((capability) => !supported.has(capability));
}

export function createExecutionProvider(
  config: ExecutionConfig,
  registry: Readonly<Record<string, ProviderFactory>> = defaultProviderRegistry
): ExecutionProvider {
  validateExecutionConfig(config);

  const factory = registry[config.provider];
  if (!factory) {
    throw new AgentRuntimeError(
      'configuration-invalid',
      `Unsupported execution provider: ${config.provider}. Configured: ${Object.keys(registry).sort().join(', ')}.`
    );
  }

  const provider = factory(config);

  // Explicit rejection, never a silent downgrade and never a failover to a
  // provider the practice did not configure.
  const missing = missingCapabilities(provider, config.requiredCapabilities);
  if (missing.length > 0) {
    throw new AgentRuntimeError(
      'capability-unsupported',
      `Provider ${provider.name} does not support: ${missing.join(', ')}.`
    );
  }

  return provider;
}
