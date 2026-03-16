import { IdexxOrderAdapter } from "./idexx/idexx-order.adapter";
import type { LabOrderAdapter, LabProvider } from "./types";

const adapters: Record<LabProvider, LabOrderAdapter> = {
  IDEXX: new IdexxOrderAdapter(),
};

export const getLabOrderAdapter = (provider: LabProvider): LabOrderAdapter =>
  adapters[provider];

export * from "./types";
