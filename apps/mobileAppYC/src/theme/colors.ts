// src/theme/colors.ts
export const colors = {
  // Primary colors - Companion app themed
  primary: '#247AED',
  primaryDark: '#E55A2B',
  primaryLight: '#FF8A65',
  primaryGlass: 'rgba(36, 122, 237, 0.92)',
  primaryTint: 'rgba(36, 122, 237, 0.2)',
  primaryTintStrong: 'rgba(36, 122, 237, 0.8)',
  primarySurface: 'rgba(36, 122, 237, 0.08)',

  // Secondary colors
  secondary: '#302F2E',
  secondaryLight: '#80E5D9',

  // Accent colors
  accent: '#FFE066',
  accentLight: '#FFF59D',

  // Neutral colors
  white: '#FFFFFF',
  whiteOverlay70: 'rgba(255, 255, 255, 0.7)',
  black: '#000000',
  gray800: '#424242',

  // Status colors
  success: '#008F5D',
  warning: '#FF9800',
  error: '#F44336',
  errorSurface: '#FDEBEA',
  info: '#2196F3',

  // Background colors
  background: '#FFFEFE',
  backgroundSecondary: '#F8F9FA',
  backgroundDark: '#121212',
  backgroundDarkSecondary: '#1E1E1E',
  lightBlueBackground: '#E9F2FD',

  // Text colors
  text: '#302F2E',
  textSecondary: '#747473',
  textTertiary: '#247AED',
  onPrimary: '#FEF8F4',
  textDark: '#FFFFFF',
  textDarkSecondary: '#E0E0E0',

  // Border colors
  border: '#EAEAEA',
  borderDark: '#424242',
  borderMuted: 'rgba(234, 234, 234, 0.9)',
  borderSeparator: '#c8c8c8ff',

  // Special UI colors
  inputBackground: '#FAFAFA',
  cardBackground: '#FFFFFF',
  cardOverlay: 'rgba(255, 255, 255, 0.95)',
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  placeholder: '#595958',
  neutralShadow: 'rgba(71, 56, 39, 0.15)',

  // Transparent colors
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(255, 255, 255, 0.9)',
} as const;
