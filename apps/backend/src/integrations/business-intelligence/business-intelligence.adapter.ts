import { IntegrationAdapter, BusinessIntelligenceCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class BusinessIntelligenceAdapter implements IntegrationAdapter {
  validateCredentials(credentials: BusinessIntelligenceCredentials) {
    return validateRequiredCredentials("BUSINESS_INTELLIGENCE", credentials, [
      "apiKey",
      "orgId",
    ]);
  }
}
