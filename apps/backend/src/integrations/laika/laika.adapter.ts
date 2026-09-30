import { IntegrationAdapter, IntegrationValidationResult } from "../types";

export class LaikaAdapter implements IntegrationAdapter {
  validateCredentials(): Promise<IntegrationValidationResult> {
    return Promise.resolve({
      ok: false,
      reason: "LAIKA cannot be validated until a connection is available.",
    });
  }
}
