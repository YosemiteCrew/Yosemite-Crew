import { AgentRuntimeError } from '../errors.js';
import type { CredentialResolver } from '../execution-provider.js';

const statusOf = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error as { status: unknown };
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

// One translation table, shared by the adapters, so "expired" means the same
// thing to product code whichever wire reported it.
export const normaliseTransportError = (error: unknown): AgentRuntimeError => {
  if (error instanceof AgentRuntimeError) {
    return error;
  }
  const message = error instanceof Error ? error.message : 'Execution provider failed.';
  switch (statusOf(error)) {
    case 401:
      return new AgentRuntimeError('credential-expired', message);
    case 403:
      return new AgentRuntimeError('credential-revoked', message);
    default:
      return new AgentRuntimeError('provider-unavailable', message, true);
  }
};

// Resolving a credential can itself fail (rotated, revoked, vault down). That
// failure is normalised too rather than surfacing as an opaque throw.
export const resolveCredential = async (credential: CredentialResolver): Promise<string> => {
  try {
    return await credential();
  } catch (error) {
    throw normaliseTransportError(error);
  }
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
