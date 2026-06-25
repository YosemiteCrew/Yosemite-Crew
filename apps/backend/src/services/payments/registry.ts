import { UnknownProviderError } from "./errors";
import type { PaymentProviderPort } from "./port";
import type { ProviderId } from "./types";

/**
 * Holds one adapter per provider and resolves the adapter for a given provider id.
 * Finance and webhook callers resolve through this registry instead of importing a
 * concrete provider service, which is what keeps the rest of finance provider-neutral.
 */
export class PaymentProviderRegistry {
  private readonly adapters = new Map<ProviderId, PaymentProviderPort>();

  register(adapter: PaymentProviderPort): void {
    this.adapters.set(adapter.provider, adapter);
  }

  has(provider: ProviderId): boolean {
    return this.adapters.has(provider);
  }

  /** Returns the adapter for the provider, or throws UnknownProviderError if none is registered. */
  get(provider: ProviderId): PaymentProviderPort {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new UnknownProviderError(provider);
    }
    return adapter;
  }

  list(): ProviderId[] {
    return [...this.adapters.keys()];
  }
}

/**
 * Resolve the adapter for an organisation. The org's active provider is read by the
 * caller (it lives on OrganizationBilling) and passed in; per-org provider selection
 * and the provider-config table arrive with the data-model deltas in #1659.
 */
export function resolveAdapterForOrg(
  registry: PaymentProviderRegistry,
  activeProvider: ProviderId,
): PaymentProviderPort {
  return registry.get(activeProvider);
}
