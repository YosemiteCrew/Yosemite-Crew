import {
  IntegrationAdapter,
  DrugInteractionCheckerCredentials,
} from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class DrugInteractionCheckerAdapter implements IntegrationAdapter {
  validateCredentials(credentials: DrugInteractionCheckerCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey"]);
  }
}
