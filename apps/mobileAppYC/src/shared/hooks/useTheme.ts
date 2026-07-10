import {useEffect, useRef} from 'react';
import {Appearance} from 'react-native';

import {useAppDispatch, useAppSelector} from '@/app/hooks';
import {setTheme, toggleTheme, updateSystemTheme} from '@/features/theme';
import {darkTheme, lightTheme} from '@/theme';

const resolveScheme = (value: string | null | undefined): 'light' | 'dark' =>
  value === 'dark' ? 'dark' : 'light';

export const DARK_MODE_ENABLED = false;

export const createThemeHook =
  (darkModeEnabled = DARK_MODE_ENABLED) =>
  () => {
    const dispatch = useAppDispatch();
    const themeState = useAppSelector(state => state.theme);
    const {theme: storedThemeMode, isDark: storedIsDark} = themeState;
    // darkModeEnabled is fixed for the lifetime of a given hook instance
    // (bound once via createThemeHook's factory parameter), so it can never
    // go stale within this effect. Routed through a ref so the static
    // exhaustive-deps check can see that stability.
    const darkModeEnabledRef = useRef(darkModeEnabled);
    darkModeEnabledRef.current = darkModeEnabled;

    useEffect(() => {
      if (!darkModeEnabledRef.current) {
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

    const effectiveThemeMode = darkModeEnabled ? storedThemeMode : 'light';
    const effectiveIsDark = darkModeEnabled ? storedIsDark : false;

    const currentTheme = effectiveIsDark ? darkTheme : lightTheme;

    const safeSetTheme = (mode: 'light' | 'dark' | 'system') => {
      if (!darkModeEnabled) {
        if (storedThemeMode !== 'light') {
          dispatch(setTheme('light'));
        }
        return;
      }

      dispatch(setTheme(mode));
    };

    const safeToggleTheme = () => {
      if (!darkModeEnabled) {
        return;
      }

      dispatch(toggleTheme());
    };

    return {
      theme: currentTheme,
      isDark: effectiveIsDark,
      themeMode: effectiveThemeMode,
      darkModeLocked: !darkModeEnabled,
      setTheme: safeSetTheme,
      toggleTheme: safeToggleTheme,
    };
  };

export const useTheme = createThemeHook();
