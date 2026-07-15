import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {CurrencyCode} from '@/shared/utils/currency';
import {SUPPORTED_CURRENCIES} from '@/shared/utils/currency';

const CURRENCY_STORAGE_KEY = 'app_currency_preference';

let _currency: CurrencyCode = 'USD';
let _loaded = false;
let _fetching = false;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach(l => l());
}

function startFetch() {
  if (_fetching) return;
  _fetching = true;
  AsyncStorage.getItem(CURRENCY_STORAGE_KEY)
    .then(stored => {
      if (stored === 'EUR' || stored === 'USD') {
        _currency = stored as CurrencyCode;
      }
    })
    .catch(error => {
      console.warn('Failed to load currency preference:', error);
    })
    .finally(() => {
      _loaded = true;
      notify();
    });
}

function subscribe(listener: () => void) {
  _listeners.add(listener);
  startFetch();
  return () => {
    _listeners.delete(listener);
  };
}

export function _resetCurrencyStoreForTesting() {
  _currency = 'USD';
  _loaded = false;
  _fetching = false;
  _listeners.clear();
}

function getCurrencySnapshot(): CurrencyCode {
  return _currency;
}

function getIsLoadingSnapshot(): boolean {
  return !_loaded;
}

const persistCurrency = async (newCurrency: CurrencyCode) => {
  if (!SUPPORTED_CURRENCIES.includes(newCurrency)) {
    console.warn(`Unsupported currency: ${newCurrency}. Supported: EUR, USD`);
    return;
  }
  try {
    await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency);
    _currency = newCurrency;
    notify();
  } catch (error) {
    console.warn('Failed to save currency preference:', error);
  }
};

export const useCurrencyPreference = () => {
  const currency = useSyncExternalStore(
    subscribe,
    getCurrencySnapshot,
    getCurrencySnapshot,
  );
  const isLoading = useSyncExternalStore(
    subscribe,
    getIsLoadingSnapshot,
    getIsLoadingSnapshot,
  );

  return {
    currency,
    setCurrency: persistCurrency,
    isLoading,
    supportedCurrencies: SUPPORTED_CURRENCIES,
  };
};
