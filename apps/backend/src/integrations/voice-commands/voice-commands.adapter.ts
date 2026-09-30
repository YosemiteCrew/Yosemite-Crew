import { IntegrationAdapter, VoiceCommandsCredentials } from "../types";
import { validateRequiredCredentials } from "../requiredCredentials";

export class VoiceCommandsAdapter implements IntegrationAdapter {
  validateCredentials(credentials: VoiceCommandsCredentials) {
    return validateRequiredCredentials("VOICE_COMMANDS", credentials, [
      "apiKey",
    ]);
  }
}
