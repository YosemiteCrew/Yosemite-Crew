import SuperTokens from 'supertokens-node';
import { getSuperTokensConfig } from '../config/supertokens.config.js';
import { setAuthHooks } from '../hooks.js';
import type { AuthHooks } from '../types.js';

let isInitialized = false;

export function initSuperTokens(hooks?: AuthHooks): void {
  if (isInitialized) {
    return;
  }

  if (hooks) {
    setAuthHooks(hooks);
  }

  SuperTokens.init(getSuperTokensConfig());
  isInitialized = true;
}
