import { IntegrationAdapter, OnlineBookingCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class OnlineBookingAdapter implements IntegrationAdapter {
  validateCredentials(credentials: OnlineBookingCredentials) {
    return validateRequiredCredentials("ONLINE_BOOKING", credentials, [
      "apiKey",
    ]);
  }
}
