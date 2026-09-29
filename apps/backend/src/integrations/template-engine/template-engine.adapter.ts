import { IntegrationAdapter, TemplateEngineCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class TemplateEngineAdapter implements IntegrationAdapter {
  validateCredentials(credentials: TemplateEngineCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
