import {useState, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useAsyncStorage = (key, initialValue = '', isFocused = false) => {
  const [storedValue, setStoredValue] = useState(initialValue);
  const [initialLoading, setInitialLoading] = useState(true);

  const getStoredItem = async (key, initialValue) => {
    try {
      const item = await AsyncStorage.getItem(key);
      const value = item ? JSON.parse(item) : initialValue;
      setStoredValue(value);
      setInitialLoading(false);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getStoredItem(key, initialValue);
  }, [isFocused]);

  const setValue = async value => {
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
