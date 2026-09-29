import { IntegrationAdapter, LaikaCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class LaikaAdapter implements IntegrationAdapter {
  validateCredentials(credentials: LaikaCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
