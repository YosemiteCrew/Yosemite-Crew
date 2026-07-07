import {
  clearPlaygroundKeys,
  DEFAULT_PLAYGROUND_MODEL,
  getDefaultBaseUrl,
  getDefaultPlaygroundSettings,
  loadPlaygroundSettings,
  PLAYGROUND_MODELS,
  PLAYGROUND_STORAGE_KEYS,
  savePlaygroundSetting,
} from '@/app/features/developers/playground/playgroundSession';

const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  delete process.env.NEXT_PUBLIC_BASE_URL;
});

afterAll(() => {
  if (ORIGINAL_BASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL;
  }
});

describe('playground session settings', () => {
  test('defaults to localhost:8000 when no env base URL is set', () => {
    expect(getDefaultBaseUrl()).toBe('http://localhost:8000');
    expect(getDefaultPlaygroundSettings()).toEqual({
      anthropicKey: '',
      yosemiteKey: '',
      baseUrl: 'http://localhost:8000',
      model: DEFAULT_PLAYGROUND_MODEL,
    });
  });

  test('uses NEXT_PUBLIC_BASE_URL when present', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.test';
    expect(getDefaultBaseUrl()).toBe('https://api.example.test');
  });

  test('offers claude-sonnet-5 as the default model plus a cheap haiku option', () => {
    expect(DEFAULT_PLAYGROUND_MODEL).toBe('claude-sonnet-5');
    expect(PLAYGROUND_MODELS.map((model) => model.id)).toEqual([
      'claude-sonnet-5',
      'claude-haiku-4-5-20251001',
    ]);
  });

  test('loads defaults when sessionStorage is empty', () => {
    expect(loadPlaygroundSettings()).toEqual(getDefaultPlaygroundSettings());
  });

  test('round-trips saved settings through sessionStorage only', () => {
    savePlaygroundSetting('anthropicKey', 'sk-ant-fake');
    savePlaygroundSetting('yosemiteKey', 'yc_test_fake');
    savePlaygroundSetting('baseUrl', 'http://localhost:9999');
    savePlaygroundSetting('model', 'claude-haiku-4-5-20251001');

    expect(loadPlaygroundSettings()).toEqual({
      anthropicKey: 'sk-ant-fake',
      yosemiteKey: 'yc_test_fake',
      baseUrl: 'http://localhost:9999',
      model: 'claude-haiku-4-5-20251001',
    });

    // Keys must live in sessionStorage, never localStorage.
    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.anthropicKey)).toBe('sk-ant-fake');
    expect(window.localStorage.getItem(PLAYGROUND_STORAGE_KEYS.anthropicKey)).toBeNull();
    expect(window.localStorage.getItem(PLAYGROUND_STORAGE_KEYS.yosemiteKey)).toBeNull();
    expect(document.cookie).not.toContain('sk-ant-fake');
  });

  test('saving an empty value removes the stored entry', () => {
    savePlaygroundSetting('anthropicKey', 'sk-ant-fake');
    savePlaygroundSetting('anthropicKey', '');
    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.anthropicKey)).toBeNull();
  });

  test('clearPlaygroundKeys removes both API keys but keeps preferences', () => {
    savePlaygroundSetting('anthropicKey', 'sk-ant-fake');
    savePlaygroundSetting('yosemiteKey', 'yc_test_fake');
    savePlaygroundSetting('model', 'claude-haiku-4-5-20251001');

    clearPlaygroundKeys();

    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.anthropicKey)).toBeNull();
    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.yosemiteKey)).toBeNull();
    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.model)).toBe(
      'claude-haiku-4-5-20251001'
    );
  });
});
