import { IntegrationAdapter, TalkatoCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class TalkatoAdapter implements IntegrationAdapter {
  validateCredentials(credentials: TalkatoCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
