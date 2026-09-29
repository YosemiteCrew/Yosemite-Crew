import { IntegrationAdapter, ClinicalAnalyticsCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ClinicalAnalyticsAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ClinicalAnalyticsCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
