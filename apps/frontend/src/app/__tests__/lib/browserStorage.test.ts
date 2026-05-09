import {
  getJsonStorageItem,
  getStorage,
  getStorageItem,
  removeStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from '@/app/lib/browserStorage';

describe('browserStorage', () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
    globalThis.window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('returns the requested storage instance when available', () => {
    expect(getStorage('local')).toBe(globalThis.window.localStorage);
    expect(getStorage('session')).toBe(globalThis.window.sessionStorage);
  });

  it('reads and writes local storage values', () => {
    expect(setStorageItem('local', 'yc:test', 'value')).toBe(true);
    expect(getStorageItem('local', 'yc:test')).toBe('value');
  });

  it('reads and writes session storage values', () => {
    expect(setStorageItem('session', 'yc:test', 'value')).toBe(true);
    expect(getStorageItem('session', 'yc:test')).toBe('value');
  });

  it('removes stored values', () => {
    globalThis.window.localStorage.setItem('yc:test', 'value');
    expect(removeStorageItem('local', 'yc:test')).toBe(true);
    expect(getStorageItem('local', 'yc:test')).toBeNull();
  });

  it('parses and serializes json payloads', () => {
    const payload = { value: 42, ok: true };
    expect(setJsonStorageItem('local', 'yc:json', payload)).toBe(true);
    expect(getJsonStorageItem<typeof payload>('local', 'yc:json')).toEqual(payload);
  });

  it('returns null for invalid json', () => {
    globalThis.window.localStorage.setItem('yc:json', '{bad json');
    expect(getJsonStorageItem('local', 'yc:json')).toBeNull();
  });

  it('returns false when storage writes throw', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(setStorageItem('local', 'yc:test', 'value')).toBe(false);
  });

  it('returns null when storage reads throw', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('read failed');
    });

    expect(getStorageItem('local', 'yc:test')).toBeNull();
  });
});
