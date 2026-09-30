import { IntegrationAdapter, InventorySyncCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class InventorySyncAdapter implements IntegrationAdapter {
  validateCredentials(credentials: InventorySyncCredentials) {
    return validateRequiredCredentials("INVENTORY_SYNC", credentials, [
      "apiKey",
      "warehouseId",
    ]);
  }
}
