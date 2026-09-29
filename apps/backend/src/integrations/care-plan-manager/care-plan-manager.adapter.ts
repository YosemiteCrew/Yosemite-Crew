import { IntegrationAdapter, CarePlanManagerCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class CarePlanManagerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: CarePlanManagerCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
