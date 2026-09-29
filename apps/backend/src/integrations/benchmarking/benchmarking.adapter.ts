import { IntegrationAdapter, BenchmarkingCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class BenchmarkingAdapter implements IntegrationAdapter {
  validateCredentials(credentials: BenchmarkingCredentials) {
    return validateRequiredCredentials(credentials, ["apiKey", "practiceId"]);
  }
}
