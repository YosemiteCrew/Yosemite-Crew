import { IntegrationAdapter, ExpenseTrackerCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ExpenseTrackerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ExpenseTrackerCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
