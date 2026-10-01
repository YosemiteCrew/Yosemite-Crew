import { IntegrationAdapter, ClientMessagingCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ClientMessagingAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ClientMessagingCredentials) {
    return validateRequiredCredentials("CLIENT_MESSAGING", credentials, [
      "apiKey",
      "orgId",
    ]);
  }
}
