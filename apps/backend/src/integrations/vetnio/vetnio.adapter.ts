import { IntegrationAdapter, VetnioCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class VetnioAdapter implements IntegrationAdapter {
  validateCredentials(credentials: VetnioCredentials) {
    return validateRequiredCredentials("VETNIO", credentials, [
      "apiKey",
      "orgId",
    ]);
  }
}
