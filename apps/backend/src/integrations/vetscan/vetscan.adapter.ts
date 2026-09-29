import { IntegrationAdapter, VetScanCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class VetScanAdapter implements IntegrationAdapter {
  validateCredentials(credentials: VetScanCredentials) {
    return validateRequiredCredentials(credentials, ["username", "password"]);
  }
}
