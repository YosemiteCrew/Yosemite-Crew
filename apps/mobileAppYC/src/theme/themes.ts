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
    lightBlueBackground:string;
    surface: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    placeholder: string;
    cardBackground: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    transparent: string;
    overlay: string;
       black: string;
       white: string;
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
    lightBlueBackground:colors.lightBlueBackground,
    surface: colors.white,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,
    border: colors.border,
    placeholder: colors.placeholder,
    cardBackground: colors.cardBackground,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    transparent: colors.transparent,
    overlay: colors.overlay,
    black: colors.black,
    white: colors.white,
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
    lightBlueBackground:colors.lightBlueBackground,
    surface: colors.gray800,
    text: colors.textDark,
    textSecondary: colors.textDarkSecondary,
    textTertiary: colors.textTertiary,
    border: colors.borderDark,
    placeholder: colors.placeholder,
    cardBackground: colors.cardBackground,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    transparent: colors.transparent,
    overlay: colors.overlayLight,
    black: colors.black,
    white: colors.white,
  },
  typography,
  spacing,
  borderRadius,
  shadows,
};
