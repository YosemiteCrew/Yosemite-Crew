import { IntegrationAdapter, EmailCampaignsCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class EmailCampaignsAdapter implements IntegrationAdapter {
  validateCredentials(credentials: EmailCampaignsCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "fromEmail"]);
  }
}
