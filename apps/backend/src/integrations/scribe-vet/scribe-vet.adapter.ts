import { IntegrationAdapter, ScribeVetCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ScribeVetAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ScribeVetCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "practiceId"]);
  }
}
