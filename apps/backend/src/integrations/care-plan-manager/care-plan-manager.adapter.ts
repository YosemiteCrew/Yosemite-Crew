import { IntegrationAdapter, CarePlanManagerCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class CarePlanManagerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: CarePlanManagerCredentials) {
    return validateRequiredCredentials("CARE_PLAN_MANAGER", credentials, [
      "apiKey",
      "orgId",
    ]);
  }
}
