import { IntegrationAdapter, TelehealthPortalCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class TelehealthPortalAdapter implements IntegrationAdapter {
  validateCredentials(credentials: TelehealthPortalCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
