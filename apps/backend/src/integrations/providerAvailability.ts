import { INTEGRATION_PROVIDERS, type IntegrationProvider } from "./types";

/**
 * Providers a practice can actually configure today.
 *
 * A provider belongs here only once its adapter verifies the connection with the
 * vendor, so the Integrations page offers it a credential form and turning it on
 * means something. Every other provider in INTEGRATION_PROVIDERS is still listed
 * and still shows as coming soon, but the service refuses to store credentials
 * for it or switch it on, because nothing would ever connect.
 *
 * Adding a provider here is only half the job: its adapter must stop being a
 * `validateRequiredCredentials` shape check, which refuses to answer for a
 * provider on this list, and must verify the connection instead.
 */
export const AVAILABLE_INTEGRATION_PROVIDERS: readonly IntegrationProvider[] = [
  "IDEXX",
  "MERCK_MANUALS",
];

const availableProviderNames: ReadonlySet<string> = new Set(
  AVAILABLE_INTEGRATION_PROVIDERS,
);

/** Every provider is on exactly one side of the line. */
export const NOT_YET_AVAILABLE_INTEGRATION_PROVIDERS: readonly IntegrationProvider[] =
  INTEGRATION_PROVIDERS.filter(
    (provider) => !availableProviderNames.has(provider),
  );

export const isProviderAvailable = (provider: IntegrationProvider): boolean =>
  availableProviderNames.has(provider);
