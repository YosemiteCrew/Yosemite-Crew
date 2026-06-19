'use strict';

export type Locale = 'en' | 'es';

export type MessageKey =
  | 'app.name'
  | 'welcome.signIn'
  | 'offline.title'
  | 'offline.retry'
  | 'menu.checkForUpdates'
  | 'menu.quit';

export type MessageCatalog = Record<MessageKey, string>;

export const DEFAULT_LOCALE: Locale = 'en';

export const catalogs: Record<Locale, MessageCatalog> = {
  en: {
    'app.name': 'Yosemite Crew PIMS',
    'welcome.signIn': 'Sign in',
    'offline.title': "You're offline",
    'offline.retry': 'Try again',
    'menu.checkForUpdates': 'Check for Updates...',
    'menu.quit': 'Quit Yosemite Crew PIMS',
  },
  es: {
    'app.name': 'Yosemite Crew PIMS',
    'welcome.signIn': 'Iniciar sesion',
    'offline.title': 'Sin conexion',
    'offline.retry': 'Intentar de nuevo',
    'menu.checkForUpdates': 'Buscar actualizaciones...',
    'menu.quit': 'Salir de Yosemite Crew PIMS',
  },
};

export const normalizeLocale = (locale?: string): Locale => {
  if (!locale) return DEFAULT_LOCALE;
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return base === 'es' ? 'es' : DEFAULT_LOCALE;
};

export const t = (key: MessageKey, locale?: string): string =>
  catalogs[normalizeLocale(locale)][key] || catalogs.en[key];
