import { IntegrationAdapter, WebsiteBuilderCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class WebsiteBuilderAdapter implements IntegrationAdapter {
  validateCredentials(credentials: WebsiteBuilderCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "domain"]);
  }
}
