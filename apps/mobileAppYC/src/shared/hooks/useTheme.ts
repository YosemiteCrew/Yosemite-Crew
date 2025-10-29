import {useEffect, useMemo} from 'react';
import {Appearance} from 'react-native';

import {useAppDispatch, useAppSelector} from '@/app/hooks';
import {setTheme, toggleTheme, updateSystemTheme} from '@/features/theme';
import {darkTheme, lightTheme} from '@/theme';

const resolveScheme = (value: string | null | undefined): 'light' | 'dark' =>
  value === 'dark' ? 'dark' : 'light';

export const DARK_MODE_ENABLED = false;

export const useTheme = () => {
  const dispatch = useAppDispatch();
  const themeState = useAppSelector(state => state.theme);
  const {theme: storedThemeMode, isDark: storedIsDark} = themeState;

  useEffect(() => {
    if (!DARK_MODE_ENABLED) {
      if (storedThemeMode !== 'light' || storedIsDark) {
        dispatch(setTheme('light'));
      }
      return;
    }

    dispatch(updateSystemTheme(resolveScheme(Appearance.getColorScheme())));

    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      dispatch(updateSystemTheme(resolveScheme(colorScheme)));
    });

    return () => {
      subscription.remove();
    };
  }, [dispatch, storedIsDark, storedThemeMode]);

  const effectiveThemeMode = DARK_MODE_ENABLED ? storedThemeMode : 'light';
  const effectiveIsDark = DARK_MODE_ENABLED ? storedIsDark : false;

  const currentTheme = useMemo(
    () => (effectiveIsDark ? darkTheme : lightTheme),
    [effectiveIsDark],
  );

  const safeSetTheme = (mode: 'light' | 'dark' | 'system') => {
    if (!DARK_MODE_ENABLED) {
      if (storedThemeMode !== 'light') {
        dispatch(setTheme('light'));
      }
      return;
    }

    dispatch(setTheme(mode));
  };

  const safeToggleTheme = () => {
    if (!DARK_MODE_ENABLED) {
      return;
    }

    dispatch(toggleTheme());
  };

  return {
    theme: currentTheme,
    isDark: effectiveIsDark,
    themeMode: effectiveThemeMode,
    darkModeLocked: !DARK_MODE_ENABLED,
    setTheme: safeSetTheme,
    toggleTheme: safeToggleTheme,
  };
};
