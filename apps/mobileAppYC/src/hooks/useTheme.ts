import {useSelector, useDispatch} from 'react-redux';
import {useEffect} from 'react';
import {Appearance} from 'react-native';
import {RootState, AppDispatch} from '../store';
import {setTheme, toggleTheme, updateSystemTheme} from '../store/slices/themeSlice';
import {lightTheme} from '../theme';

export const useTheme = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useSelector((state: RootState) => state.theme);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      dispatch(updateSystemTheme(colorScheme || 'light'));
    });

    return () => subscription?.remove();
  }, [dispatch]);

  const currentTheme = lightTheme;
  const isDarkMode = false;

  return {
    theme: currentTheme,
    isDark: isDarkMode,
    themeMode: theme,
    setTheme: (newTheme: 'light' | 'dark' | 'system') =>
      dispatch(setTheme(newTheme)),
    toggleTheme: () => dispatch(toggleTheme()),
  };
};
