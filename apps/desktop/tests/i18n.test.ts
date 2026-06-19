import { catalogs, normalizeLocale, t } from '../src/utils/i18n';

describe('i18n', () => {
  test('normalizes supported and unsupported locales', () => {
    expect(normalizeLocale()).toBe('en');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('es_MX')).toBe('es');
    expect(normalizeLocale('fr-FR')).toBe('en');
  });

  test('returns baseline English strings', () => {
    expect(t('app.name', 'en')).toBe('Yosemite Crew PIMS');
    expect(t('welcome.signIn', 'en')).toBe('Sign in');
  });

  test('keeps the Spanish locale complete', () => {
    expect(Object.keys(catalogs.es).sort()).toEqual(Object.keys(catalogs.en).sort());
    expect(t('offline.retry', 'es')).toBe('Intentar de nuevo');
    expect(t('welcome.signIn', 'es')).toBe('Iniciar sesion');
  });
});
