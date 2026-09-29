import { IntegrationAdapter, BehaviorLoggerCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class BehaviorLoggerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: BehaviorLoggerCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
