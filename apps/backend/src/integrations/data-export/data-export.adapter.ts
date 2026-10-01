import { IntegrationAdapter, DataExportCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class DataExportAdapter implements IntegrationAdapter {
  validateCredentials(credentials: DataExportCredentials) {
    return validateRequiredCredentials("DATA_EXPORT", credentials, [
      "apiKey",
      "exportScope",
    ]);
  }
}
