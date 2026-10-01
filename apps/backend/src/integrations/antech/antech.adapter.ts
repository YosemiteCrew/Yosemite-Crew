import { IntegrationAdapter, AntechCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class AntechAdapter implements IntegrationAdapter {
  validateCredentials(credentials: AntechCredentials) {
    return validateRequiredCredentials("ANTECH", credentials, [
      "username",
      "password",
      "accountId",
    ]);
  }
}
