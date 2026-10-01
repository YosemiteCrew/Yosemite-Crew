import { IntegrationAdapter, MonitorSyncCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class MonitorSyncAdapter implements IntegrationAdapter {
  validateCredentials(credentials: MonitorSyncCredentials) {
    return validateRequiredCredentials("MONITOR_SYNC", credentials, [
      "apiKey",
      "deviceId",
    ]);
  }
}
