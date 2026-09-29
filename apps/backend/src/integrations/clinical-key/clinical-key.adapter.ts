import { IntegrationAdapter, ClinicalKeyCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ClinicalKeyAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ClinicalKeyCredentials) {
    return validateRequiredCredentials(credentials, ["username", "password"]);
  }
}
