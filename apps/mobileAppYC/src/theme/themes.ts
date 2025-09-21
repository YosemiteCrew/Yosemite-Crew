import {colors} from './colors';
import {typography} from './typography';
import {spacing, borderRadius, shadows} from './spacing';

export interface Theme {
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    background: string;
    backgroundSecondary: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    transparent: string;
    overlay: string;
  };
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
}

export const lightTheme: Theme = {
  colors: {
    primary: colors.primary,
    primaryDark: colors.primaryDark,
    primaryLight: colors.primaryLight,
    secondary: colors.secondary,
    accent: colors.accent,
    background: colors.background,
    backgroundSecondary: colors.backgroundSecondary,
    surface: colors.white,
    text: colors.text,
    textSecondary: colors.textSecondary,
    border: colors.border,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    transparent: colors.transparent,
    overlay: colors.overlay,
  },
  typography,
  spacing,
  borderRadius,
  shadows,
};

export const darkTheme: Theme = {
  colors: {
    primary: colors.primaryLight,
    primaryDark: colors.primary,
    primaryLight: colors.primaryDark,
    secondary: colors.secondaryLight,
    accent: colors.accentLight,
    background: colors.backgroundDark,
    backgroundSecondary: colors.backgroundDarkSecondary,
    surface: colors.gray800,
    text: colors.textDark,
    textSecondary: colors.textDarkSecondary,
    border: colors.borderDark,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    transparent: colors.transparent,
    overlay: colors.overlayLight,
  },
  typography,
  spacing,
  borderRadius,
  shadows,
};