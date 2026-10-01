import { IntegrationAdapter, QuickBooksCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class QuickBooksAdapter implements IntegrationAdapter {
  validateCredentials(credentials: QuickBooksCredentials) {
    return validateRequiredCredentials("QUICKBOOKS", credentials, [
      "realmId",
      "accessToken",
      "refreshToken",
    ]);
  }
}
