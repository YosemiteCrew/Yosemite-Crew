import { IntegrationAdapter, DigitalIntakeCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class DigitalIntakeAdapter implements IntegrationAdapter {
  validateCredentials(credentials: DigitalIntakeCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
