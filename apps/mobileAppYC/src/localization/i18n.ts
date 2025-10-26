import i18nInstance from 'i18next';
import {initReactI18next} from 'react-i18next';
import {getLocales} from 'react-native-localize';

// Import translation resources
import en from './resources/en/common.json';
import es from './resources/es/common.json';

const resources = {
  en: {
    common: en,
  },
  es: {
    common: es,
  },
};

// Get device language
const deviceLanguage = getLocales()[0]?.languageCode || 'en';

i18nInstance
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4', // Changed from v3 to v4
    resources,
    lng: deviceLanguage,
    fallbackLng: 'en',
    debug: __DEV__,

    // Common settings
    interpolation: {
      escapeValue: false, // React already does escaping
    },

    // Use common namespace by default
    defaultNS: 'common',

    // React settings
    react: {
      useSuspense: false,
    },
  });

export {default} from 'i18next';
