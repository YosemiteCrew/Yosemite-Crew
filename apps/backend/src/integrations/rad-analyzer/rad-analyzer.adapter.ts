import { IntegrationAdapter, RadAnalyzerCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class RadAnalyzerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: RadAnalyzerCredentials) {
    return validateRequiredCredentials("RAD_ANALYZER", credentials, [
      "apiKey",
      "deviceId",
    ]);
  }
}
