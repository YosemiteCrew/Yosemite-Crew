import SuperTokens from 'supertokens-node';
import { getSuperTokensConfig } from '../config/supertokens.config.js';

let isInitialized = false;

export function initSuperTokens(): void {
  if (isInitialized) {
    return;
  }

  SuperTokens.init(getSuperTokensConfig());
  isInitialized = true;
}
