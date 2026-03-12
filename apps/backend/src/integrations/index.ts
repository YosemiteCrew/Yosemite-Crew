import { IdexxAdapter } from "./idexx/idexx.adapter";
import { MerckAdapter } from "./merck/merck.adapter";
import type { IntegrationAdapter, IntegrationProvider } from "./types";
export * from "./types";

const adapters: Record<IntegrationProvider, IntegrationAdapter> = {
  IDEXX: new IdexxAdapter(),
  MERCK_MANUALS: new MerckAdapter(),
};

export const getIntegrationAdapter = (
  provider: IntegrationProvider,
): IntegrationAdapter => adapters[provider];
