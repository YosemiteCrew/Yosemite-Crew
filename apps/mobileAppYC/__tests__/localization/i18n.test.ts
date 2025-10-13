import i18n from '@/localization/i18n';

// Mock react-native-localize
jest.mock('react-native-localize', () => ({
  getLocales: jest.fn(() => [{languageCode: 'en', countryCode: 'US'}]),
}));

describe('i18n configuration', () => {
  it('should be initialized', () => {
    expect(i18n).toBeDefined();
    expect(i18n.isInitialized).toBe(true);
  });

  it('should have English as default language', () => {
    expect(i18n.language).toBe('en');
  });

  it('should have English translations loaded', () => {
    expect(i18n.hasResourceBundle('en', 'common')).toBe(true);
  });

  it('should have Spanish translations loaded', () => {
    expect(i18n.hasResourceBundle('es', 'common')).toBe(true);
  });

  it('should have fallback language set to English', () => {
    expect(i18n.options.fallbackLng).toContain('en');
  });

  it('should have common namespace as default', () => {
    expect(i18n.options.defaultNS).toBe('common');
  });

  it('should have escapeValue set to false for React', () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
  });

  it('should have useSuspense set to false', () => {
    expect(i18n.options.react?.useSuspense).toBe(false);
  });

  it('should translate common keys', () => {
    const translation = i18n.t('welcome', {ns: 'common'});
    expect(translation).toBeDefined();
    expect(typeof translation).toBe('string');
  });

  it('should change language to Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.language).toBe('es');

    // Change back to English
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
  });

  it('should return key when translation is missing', () => {
    const missingKey = 'some.missing.key.that.does.not.exist';
    const result = i18n.t(missingKey);
    expect(result).toContain('missing');
  });

  it('should support interpolation', () => {
    // Assuming there's a translation with interpolation
    const result = i18n.t('test', {defaultValue: 'Hello {{name}}', name: 'World'});
    expect(result).toContain('World');
  });
});
