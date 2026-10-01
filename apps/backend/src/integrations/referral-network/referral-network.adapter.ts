import { IntegrationAdapter, ReferralNetworkCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ReferralNetworkAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ReferralNetworkCredentials) {
    return validateRequiredCredentials("REFERRAL_NETWORK", credentials, [
      "apiKey",
      "orgId",
    ]);
  }
}
