import { IntegrationAdapter, ProtocolSyncCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ProtocolSyncAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ProtocolSyncCredentials) {
    return validateRequiredCredentials("PROTOCOL_SYNC", credentials, [
      "apiKey",
    ]);
  }
}
