import { IntegrationAdapter, ConfigSyncCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ConfigSyncAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ConfigSyncCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
