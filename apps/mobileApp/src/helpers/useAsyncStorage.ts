// src/helpers/useAsyncStorage.ts
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. We introduce `<T>`, a placeholder for any type we want to store.
// 2. We define the exact shape of the array that the hook returns.
type SetValue<T> = (value: T | ((val: T) => T)) => Promise<void>;
type AsyncStorageHook<T> = [T, SetValue<T>, boolean];

const useAsyncStorage = <T>(
  key: string,
  initialValue: T,
  isFocused = false,
): AsyncStorageHook<T> => {
  // 3. The state is now strongly typed with <T>.
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [initialLoading, setInitialLoading] = useState(true);

  const getStoredItem = async (key: string, initialValue: T) => {
    try {
      const item = await AsyncStorage.getItem(key);
      // If an item is found, parse it; otherwise, use the initial value.
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
  }, [key, isFocused]); // Added `key` to dependency array for correctness

  const setValue: SetValue<T> = async value => {
    try {
      // 4. This allows setting a value directly or with a function, just like useState.
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