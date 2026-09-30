import { IntegrationAdapter, CallIntegrationCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class CallIntegrationAdapter implements IntegrationAdapter {
  validateCredentials(credentials: CallIntegrationCredentials) {
    return validateRequiredCredentials("CALL_INTEGRATION", credentials, [
      "apiKey",
      "accountId",
    ]);
  }
}
