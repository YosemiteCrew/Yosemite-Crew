import { IntegrationAdapter, FormBuilderCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class FormBuilderAdapter implements IntegrationAdapter {
  validateCredentials(credentials: FormBuilderCredentials) {
    return validateRequiredCredentials("FORM_BUILDER", credentials, [
      "apiKey",
      "orgId",
    ]);
  }
}
