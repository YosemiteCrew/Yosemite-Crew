import { IntegrationAdapter, ComplianceReporterCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ComplianceReporterAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ComplianceReporterCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "jurisdiction"]);
  }
}
