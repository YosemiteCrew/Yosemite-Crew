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
export const createGlassCardStyles = (theme: any, config?: Partial<CardStyleConfig>) => {
  const defaultConfig: CardStyleConfig = {
    borderRadius: theme.borderRadius?.lg || 16,
    borderWidth: 1,
    padding: theme.spacing?.[4] || 16,
  };

  const finalConfig = {...defaultConfig, ...config};

  return {
    card: {
      borderRadius: finalConfig.borderRadius,
      borderWidth: finalConfig.borderWidth,
      borderColor: theme.colors?.borderMuted || '#E0E0E0',
      overflow: 'hidden' as const,
      backgroundColor: theme.colors?.cardBackground || '#FFFFFF',
      ...(theme.shadows?.md),
      shadowColor: theme.colors?.neutralShadow || '#000000',
      padding: finalConfig.padding,
    },
    fallback: {
      borderRadius: finalConfig.borderRadius,
      backgroundColor: theme.colors?.cardBackground || '#FFFFFF',
      borderColor: theme.colors?.border || '#E0E0E0',
      overflow: 'hidden' as const,
    },
  };
};

/**
 * Creates common content container styles for cards
 */
export const createCardContentStyles = (theme: any, gap: number = 3) => ({
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing?.[gap] || gap * 4,
  },
});

/**
 * Creates common icon container styles
 */
export const createIconContainerStyles = (
  theme: any,
  size: number = 48,
  borderRadius?: number
) => ({
  iconContainer: {
    width: size,
    height: size,
    borderRadius: borderRadius ?? theme.borderRadius?.base ?? size / 2,
    backgroundColor: theme.colors?.surface || '#F5F5F5',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

/**
 * Creates common text container styles
 */
export const createTextContainerStyles = (theme: any, gap: number = 1) => ({
  textContainer: {
    flex: 1,
    gap: theme.spacing?.[gap] || gap * 4,
  },
});
