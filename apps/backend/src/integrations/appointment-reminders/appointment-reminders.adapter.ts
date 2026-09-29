import { IntegrationAdapter, AppointmentRemindersCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class AppointmentRemindersAdapter implements IntegrationAdapter {
  validateCredentials(credentials: AppointmentRemindersCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
