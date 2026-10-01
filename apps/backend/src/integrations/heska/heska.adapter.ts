import { IntegrationAdapter, HeskaCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class HeskaAdapter implements IntegrationAdapter {
  validateCredentials(credentials: HeskaCredentials) {
    return validateRequiredCredentials("HESKA", credentials, [
      "apiKey",
      "deviceSerial",
    ]);
  }
}
