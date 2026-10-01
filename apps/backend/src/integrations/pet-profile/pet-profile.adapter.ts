import { IntegrationAdapter, PetProfileCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class PetProfileAdapter implements IntegrationAdapter {
  validateCredentials(credentials: PetProfileCredentials) {
    return validateRequiredCredentials("PET_PROFILE", credentials, [
      "apiKey",
      "orgId",
    ]);
  }
}
