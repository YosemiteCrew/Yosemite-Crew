import { IntegrationAdapter, WhatsAppBusinessCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class WhatsAppBusinessAdapter implements IntegrationAdapter {
  validateCredentials(credentials: WhatsAppBusinessCredentials) {
    return validateRequiredCredentials("WHATSAPP_BUSINESS", credentials, [
      "apiKey",
      "phoneNumberId",
    ]);
  }
}
