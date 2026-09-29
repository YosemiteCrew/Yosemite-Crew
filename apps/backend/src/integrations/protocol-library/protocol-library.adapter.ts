import { IntegrationAdapter, ProtocolLibraryCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ProtocolLibraryAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ProtocolLibraryCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "orgId"]);
  }
}
