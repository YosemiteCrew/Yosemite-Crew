import { IntegrationAdapter, BillingAutomationCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class BillingAutomationAdapter implements IntegrationAdapter {
  validateCredentials(credentials: BillingAutomationCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
