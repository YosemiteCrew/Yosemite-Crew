import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SetValue<T> = (value: T | ((val: T) => T)) => Promise<void>;
type AsyncStorageHook<T> = [T, SetValue<T>, boolean];

const useAsyncStorage = <T>(
  key: string,
  initialValue: T,
  isFocused = false,
): AsyncStorageHook<T> => {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [initialLoading, setInitialLoading] = useState(true);

  const getStoredItem = async (key: string, initialValue: T) => {
    try {
      const item = await AsyncStorage.getItem(key);
      const value = item ? (JSON.parse(item) as T) : initialValue;
      setStoredValue(value);
    } catch (error) {
      console.log(error);
      // If error parsing, fall back to initial value
      setStoredValue(initialValue);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    getStoredItem(key, initialValue);
  }, [key, isFocused]);

  const setValue: SetValue<T> = async value => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      await AsyncStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue, initialLoading];
};

export default useAsyncStorage;