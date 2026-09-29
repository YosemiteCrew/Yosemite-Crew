import { IntegrationAdapter, PetInsuranceCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class PetInsuranceAdapter implements IntegrationAdapter {
  validateCredentials(credentials: PetInsuranceCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "partnerId"]);
  }
}
