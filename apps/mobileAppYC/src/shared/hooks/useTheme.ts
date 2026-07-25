import {useEffect} from 'react';
import {Appearance} from 'react-native';

import {useAppDispatch, useAppSelector} from '@/app/hooks';
import {setTheme, toggleTheme, updateSystemTheme} from '@/features/theme';
import {darkTheme, lightTheme} from '@/theme';

const resolveScheme = (value: string | null | undefined): 'light' | 'dark' =>
  value === 'dark' ? 'dark' : 'light';

/**
 * Resolves the active warm-bone theme (light or espresso dark) from the
 * persisted preference and keeps "system" mode in sync with the OS appearance.
 */
export const useTheme = () => {
  const dispatch = useAppDispatch();
  const {theme: themeMode, isDark} = useAppSelector(state => state.theme);

  useEffect(() => {
    dispatch(updateSystemTheme(resolveScheme(Appearance.getColorScheme())));

    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      dispatch(updateSystemTheme(resolveScheme(colorScheme)));
    });

    // Older RN / test mocks can return void from addChangeListener.
    return () => {
      subscription?.remove?.();
    };
  }, [dispatch]);

  return {
    theme: isDark ? darkTheme : lightTheme,
    isDark,
    themeMode,
    darkModeLocked: false,
    setTheme: (mode: 'light' | 'dark' | 'system') => dispatch(setTheme(mode)),
    toggleTheme: () => dispatch(toggleTheme()),
  };
};
