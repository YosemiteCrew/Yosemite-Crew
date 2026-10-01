import { IntegrationAdapter, PlumbVeterinaryCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class PlumbVeterinaryAdapter implements IntegrationAdapter {
  validateCredentials(credentials: PlumbVeterinaryCredentials) {
    return validateRequiredCredentials("PLUMB_VETERINARY", credentials, [
      "username",
      "password",
    ]);
  }
}
