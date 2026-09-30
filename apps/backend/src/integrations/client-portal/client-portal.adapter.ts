import { IntegrationAdapter, ClientPortalCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ClientPortalAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ClientPortalCredentials) {
    return validateRequiredCredentials("CLIENT_PORTAL", credentials, [
      "apiKey",
      "orgId",
    ]);
  }
}
