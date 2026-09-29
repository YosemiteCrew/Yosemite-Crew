import { IntegrationAdapter, DosageCalculatorCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class DosageCalculatorAdapter implements IntegrationAdapter {
  validateCredentials(credentials: DosageCalculatorCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
