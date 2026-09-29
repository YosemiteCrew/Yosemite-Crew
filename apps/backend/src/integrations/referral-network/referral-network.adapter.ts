import { IntegrationAdapter, ReferralNetworkCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ReferralNetworkAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ReferralNetworkCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
