import { IntegrationAdapter, PayrollProviderCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class PayrollProviderAdapter implements IntegrationAdapter {
  validateCredentials(credentials: PayrollProviderCredentials) {
    return validateRequiredCredentials("PAYROLL_PROVIDER", credentials, [
      "apiKey",
      "companyId",
    ]);
  }
}
