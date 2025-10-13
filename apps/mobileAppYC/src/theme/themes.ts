import {colors} from './colors';
import {typography} from './typography';
import {spacing, borderRadius, shadows} from './spacing';

export interface Theme {
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    primaryGlass: string;
    primaryTint: string;
    primaryTintStrong: string;
    primarySurface: string;
    secondary: string;
    accent: string;
    background: string;
    backgroundSecondary: string;
    lightBlueBackground: string;
    surface: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    onPrimary: string;
    border: string;
    borderMuted: string;
    placeholder: string;
    cardBackground: string;
    cardOverlay: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    errorSurface: string;
    transparent: string;
    overlay: string;
    whiteOverlay70: string;
    black: string;
    white: string;
    neutralShadow: string;
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
    primaryGlass: colors.primaryGlass,
    primaryTint: colors.primaryTint,
    primaryTintStrong: colors.primaryTintStrong,
    primarySurface: colors.primarySurface,
    secondary: colors.secondary,
    accent: colors.accent,
    background: colors.background,
    backgroundSecondary: colors.backgroundSecondary,
    lightBlueBackground: colors.lightBlueBackground,
    surface: colors.white,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,
    onPrimary: colors.onPrimary,
    border: colors.border,
    borderMuted: colors.borderMuted,
    placeholder: colors.placeholder,
    cardBackground: colors.cardBackground,
    cardOverlay: colors.cardOverlay,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    errorSurface: colors.errorSurface,
    transparent: colors.transparent,
    overlay: colors.overlay,
    whiteOverlay70: colors.whiteOverlay70,
    black: colors.black,
    white: colors.white,
    neutralShadow: colors.neutralShadow,
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
    primaryGlass: colors.primaryGlass,
    primaryTint: colors.primaryTint,
    primaryTintStrong: colors.primaryTintStrong,
    primarySurface: colors.primarySurface,
    secondary: colors.secondaryLight,
    accent: colors.accentLight,
    background: colors.backgroundDark,
    backgroundSecondary: colors.backgroundDarkSecondary,
    lightBlueBackground: colors.lightBlueBackground,
    surface: colors.gray800,
    text: colors.textDark,
    textSecondary: colors.textDarkSecondary,
    textTertiary: colors.textTertiary,
    onPrimary: colors.textDark,
    border: colors.borderDark,
    borderMuted: colors.borderDark,
    placeholder: colors.placeholder,
    cardBackground: colors.cardBackground,
    cardOverlay: colors.overlay,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    errorSurface: colors.errorSurface,
    transparent: colors.transparent,
    overlay: colors.overlayLight,
    whiteOverlay70: colors.whiteOverlay70,
    black: colors.black,
    white: colors.white,
    neutralShadow: colors.overlay,
  },
  typography,
  spacing,
  borderRadius,
  shadows,
};
