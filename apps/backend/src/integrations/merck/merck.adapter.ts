import {
  IntegrationAdapter,
  IntegrationValidationResult,
} from "src/integrations/types";

export class MerckAdapter implements IntegrationAdapter {
  validateCredentials(): Promise<IntegrationValidationResult> {
    return Promise.resolve({ ok: true });
  }
}
