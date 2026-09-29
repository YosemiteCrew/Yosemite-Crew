import { IntegrationAdapter, ClientPortalCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ClientPortalAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ClientPortalCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
