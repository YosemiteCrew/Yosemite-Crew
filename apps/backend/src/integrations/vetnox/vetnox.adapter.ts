import { IntegrationAdapter, VetnoxCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class VetnoxAdapter implements IntegrationAdapter {
  validateCredentials(credentials: VetnoxCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "practiceId"]);
  }
}
