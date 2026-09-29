import { IntegrationAdapter, WellnessTrackerCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class WellnessTrackerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: WellnessTrackerCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
