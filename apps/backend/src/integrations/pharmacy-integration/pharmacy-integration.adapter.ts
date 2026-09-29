import { IntegrationAdapter, PharmacyIntegrationCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class PharmacyIntegrationAdapter implements IntegrationAdapter {
  validateCredentials(credentials: PharmacyIntegrationCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "pharmacyId"]);
  }
}
