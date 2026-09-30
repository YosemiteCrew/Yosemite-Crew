import { IntegrationAdapter, SupplyChainCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class SupplyChainAdapter implements IntegrationAdapter {
  validateCredentials(credentials: SupplyChainCredentials) {
    return validateRequiredCredentials("SUPPLY_CHAIN", credentials, [
      "apiKey",
      "vendorId",
    ]);
  }
}
