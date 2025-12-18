import type {Theme} from '@/theme/themes';

/**
 * Common card style utilities to reduce duplication across card components
 */

export interface CardStyleConfig {
  borderRadius: number;
  borderWidth: number;
  padding: number;
}

/**
 * Creates common glass card styles with consistent theming
 */
export const createGlassCardStyles = (theme: Theme, config?: Partial<CardStyleConfig>) => {
  const defaultConfig: CardStyleConfig = {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    padding: theme.spacing['4'],
  };

  const finalConfig = {...defaultConfig, ...config};

  return {
    card: {
      borderRadius: finalConfig.borderRadius,
      borderWidth: finalConfig.borderWidth,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden' as const,
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      padding: finalConfig.padding,
    },
    fallback: {
      borderRadius: finalConfig.borderRadius,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
      overflow: 'hidden' as const,
    },
  };
};

/**
 * Creates common content container styles for cards
 */
export const createCardContentStyles = (theme: Theme, gapKey: keyof typeof theme.spacing = '3') => ({
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing[gapKey],
  },
});

/**
 * Creates common icon container styles
 */
export const createIconContainerStyles = (
  theme: Theme,
  size: number = 48,
  borderRadius?: number
) => ({
  iconContainer: {
    width: size,
    height: size,
    borderRadius: borderRadius ?? theme.borderRadius.base,
    backgroundColor: theme.colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

/**
 * Creates common text container styles
 */
export const createTextContainerStyles = (theme: Theme, gapKey: keyof typeof theme.spacing = '1') => ({
  textContainer: {
    flex: 1,
    gap: theme.spacing[gapKey],
  },
});
