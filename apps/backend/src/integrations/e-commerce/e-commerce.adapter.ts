import { IntegrationAdapter, ECommerceCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ECommerceAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ECommerceCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "storeId"]);
  }
}
