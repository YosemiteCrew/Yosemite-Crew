import {colors, colorsDark, type ColorTokens} from './colors';
import {typography} from './typography';
import {spacing, borderRadius, shadows} from './spacing';

export interface Theme {
  colors: ColorTokens;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
}

export const lightTheme: Theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export const darkTheme: Theme = {
  colors: colorsDark,
  typography,
  spacing,
  borderRadius,
  shadows,
};
