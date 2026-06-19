'use strict';

export type BiometricPlatform = 'macos' | 'windows' | 'unsupported';

export const detectPlatform = (platform: string = process.platform): BiometricPlatform => {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'unsupported';
};

export interface BiometricLock {
  isAvailable: () => boolean;
  authenticate: (reason?: string) => Promise<boolean>;
  isLocked: () => boolean;
  lock: () => void;
  unlock: () => void;
  getPlatform: () => BiometricPlatform;
}

interface BiometricDeps {
  platform?: BiometricPlatform;
  canPromptTouchID?: () => boolean;
  promptTouchID?: (reason: string) => Promise<boolean>;
}

export const createBiometricLock = (deps: BiometricDeps = {}): BiometricLock => {
  const platform = deps.platform ?? detectPlatform();
  let locked = false;

  const canPromptTouchID = deps.canPromptTouchID;
  const promptTouchID = deps.promptTouchID;

  const isAvailable = (): boolean => {
    if (platform === 'macos' && canPromptTouchID) {
      try {
        return canPromptTouchID();
      } catch {
        return false;
      }
    }
    if (platform === 'windows') {
      return false;
    }
    return false;
  };

  const authenticate = async (reason?: string): Promise<boolean> => {
    if (platform === 'macos' && promptTouchID) {
      try {
        const result = await promptTouchID(reason || 'Authenticate to unlock');
        if (result) locked = false;
        return result;
      } catch {
        return false;
      }
    }
    if (platform === 'windows') {
      return false;
    }
    return false;
  };

  const isLocked = (): boolean => locked;

  const lock = (): void => {
    locked = true;
  };

  const unlock = (): void => {
    locked = false;
  };

  const getPlatform = (): BiometricPlatform => platform;

  return { isAvailable, authenticate, isLocked, lock, unlock, getPlatform };
};
