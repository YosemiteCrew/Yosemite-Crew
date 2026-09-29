import { IntegrationAdapter, TemplateManagerCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class TemplateManagerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: TemplateManagerCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
