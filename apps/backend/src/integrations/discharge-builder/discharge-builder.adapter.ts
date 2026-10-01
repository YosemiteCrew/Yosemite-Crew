import { IntegrationAdapter, DischargeBuilderCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class DischargeBuilderAdapter implements IntegrationAdapter {
  validateCredentials(credentials: DischargeBuilderCredentials) {
    return validateRequiredCredentials("DISCHARGE_BUILDER", credentials, [
      "apiKey",
    ]);
  }
}
