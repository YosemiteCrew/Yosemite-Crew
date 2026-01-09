import {useEffect, useState} from 'react';
import {Keyboard} from 'react-native';

/**
 * Hook to track keyboard visibility state
 * @returns boolean indicating whether the keyboard is currently visible
 */
export const useKeyboardVisible = (): boolean => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  return isKeyboardVisible;
};
