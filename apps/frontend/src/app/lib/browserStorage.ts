type StorageKind = 'local' | 'session';

const noopStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

const resolveStorage = (kind: StorageKind): Storage | null => {
  try {
    const browserWindow = globalThis.window;
    if (!browserWindow) return null;
    return kind === 'local' ? browserWindow.localStorage : browserWindow.sessionStorage;
  } catch {
    return null;
  }
};

export const getStorage = (kind: StorageKind): Storage | null => {
  return resolveStorage(kind);
};

export const getPersistStorage = (kind: StorageKind): Storage => {
  return resolveStorage(kind) ?? noopStorage;
};

export const getStorageItem = (kind: StorageKind, key: string): string | null => {
  try {
    return resolveStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const setStorageItem = (kind: StorageKind, key: string, value: string): boolean => {
  try {
    resolveStorage(kind)?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeStorageItem = (kind: StorageKind, key: string): boolean => {
  try {
    resolveStorage(kind)?.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const getJsonStorageItem = <T>(kind: StorageKind, key: string): T | null => {
  const raw = getStorageItem(kind, key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const setJsonStorageItem = <T>(kind: StorageKind, key: string, value: T): boolean => {
  return setStorageItem(kind, key, JSON.stringify(value));
};
