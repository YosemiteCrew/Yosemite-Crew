import {useState, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {CurrencyCode} from '@/shared/utils/currency';
import {SUPPORTED_CURRENCIES} from '@/shared/utils/currency';

const CURRENCY_STORAGE_KEY = 'app_currency_preference';

/**
 * Hook to manage user's currency preference with localStorage persistence
 * Supports EUR and USD only
 * Defaults to USD if not set
 */
export const useCurrencyPreference = () => {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [isLoading, setIsLoading] = useState(true);

  // Load currency from localStorage on mount
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const stored = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
        if (stored && (stored === 'EUR' || stored === 'USD')) {
          setCurrencyState(stored as CurrencyCode);
        }
      } catch (error) {
        console.warn('Failed to load currency preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrency();
  }, []);

  // Save currency to localStorage when it changes
  const setCurrency = async (newCurrency: CurrencyCode) => {
    if (!SUPPORTED_CURRENCIES.includes(newCurrency)) {
      console.warn(`Unsupported currency: ${newCurrency}. Supported: EUR, USD`);
      return;
    }

    try {
      await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency);
      setCurrencyState(newCurrency);
    } catch (error) {
      console.warn('Failed to save currency preference:', error);
    }
  };

  return {
    currency,
    setCurrency,
    isLoading,
    supportedCurrencies: SUPPORTED_CURRENCIES,
  };
};
