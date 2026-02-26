import { IdexxAdapter } from "./idexx/idexx.adapter";
import type { IntegrationAdapter, IntegrationProvider } from "./types";
export * from "./types";

const adapters: Record<IntegrationProvider, IntegrationAdapter> = {
  IDEXX: new IdexxAdapter(),
};

export const getIntegrationAdapter = (
  provider: IntegrationProvider,
): IntegrationAdapter => adapters[provider];
