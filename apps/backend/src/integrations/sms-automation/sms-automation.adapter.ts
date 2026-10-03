import { IntegrationAdapter, SmsAutomationCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class SmsAutomationAdapter implements IntegrationAdapter {
  validateCredentials(credentials: SmsAutomationCredentials) {
    return validateRequiredCredentials("SMS_AUTOMATION", credentials, [
      "accountSid",
      "authToken",
      "fromNumber",
    ]);
  }
}
