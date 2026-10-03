import { IntegrationAdapter, ReviewManagerCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class ReviewManagerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: ReviewManagerCredentials) {
    return validateRequiredCredentials("REVIEW_MANAGER", credentials, [
      "apiKey",
    ]);
  }
}
