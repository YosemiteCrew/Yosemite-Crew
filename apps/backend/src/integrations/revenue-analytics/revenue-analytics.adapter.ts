import { IntegrationAdapter, RevenueAnalyticsCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class RevenueAnalyticsAdapter implements IntegrationAdapter {
  validateCredentials(credentials: RevenueAnalyticsCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
