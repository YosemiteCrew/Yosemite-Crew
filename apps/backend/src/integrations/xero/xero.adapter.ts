import { IntegrationAdapter, XeroCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class XeroAdapter implements IntegrationAdapter {
  validateCredentials(credentials: XeroCredentials) {
    return validateRequiredCredentials("XERO", credentials, [
      "clientId",
      "clientSecret",
      "tenantId",
    ]);
  }
}
