import { IntegrationAdapter, LoyaltyProgramCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class LoyaltyProgramAdapter implements IntegrationAdapter {
  validateCredentials(credentials: LoyaltyProgramCredentials) {
    return validateRequiredCredentials("LOYALTY_PROGRAM", credentials, [
      "apiKey",
      "programId",
    ]);
  }
}
