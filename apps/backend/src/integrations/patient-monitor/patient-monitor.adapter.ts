import { IntegrationAdapter, PatientMonitorCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class PatientMonitorAdapter implements IntegrationAdapter {
  validateCredentials(credentials: PatientMonitorCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "deviceId"]);
  }
}
