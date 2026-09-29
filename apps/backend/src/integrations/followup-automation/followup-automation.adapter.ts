import { IntegrationAdapter, FollowupAutomationCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class FollowupAutomationAdapter implements IntegrationAdapter {
  validateCredentials(credentials: FollowupAutomationCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
