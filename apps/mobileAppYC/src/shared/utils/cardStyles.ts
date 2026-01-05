import type {Theme} from '@/theme/themes';

/**
 * Common card style utilities to reduce duplication across card components
 */

export interface CardStyleConfig {
  borderRadius: number;
  borderWidth: number;
  padding: number;
}

const fallbackGap = (gapKey: unknown) => {
  if (typeof gapKey === 'number') return gapKey * 4;
  const asNumber = Number(gapKey);
  return Number.isFinite(asNumber) ? asNumber * 4 : 0;
};

const getSpacing = (theme: any, gapKey: unknown, fallback?: number) =>
  theme?.spacing?.[gapKey as any] ??
  theme?.spacing?.[String(gapKey)] ??
  (fallback ?? fallbackGap(gapKey));

const getBorderRadius = (theme: any, key: string, fallback: number) =>
  theme?.borderRadius?.[key] ?? fallback;

/**
 * Creates common glass card styles with consistent theming
 */
export const createGlassCardStyles = (theme: Theme, config?: Partial<CardStyleConfig>) => {
  const borderRadiusFallback = 16;
  const paddingFallback = 16;
  const colors = (theme as any)?.colors ?? {};

  const defaultConfig: CardStyleConfig = {
    borderRadius: getBorderRadius(theme, 'lg', borderRadiusFallback),
    borderWidth: 1,
    padding: getSpacing(theme, '4', paddingFallback),
  };

  const finalConfig = {...defaultConfig, ...config};

  return {
    card: {
      borderRadius: finalConfig.borderRadius,
      borderWidth: finalConfig.borderWidth,
      borderColor: colors.borderMuted ?? '#EAEAEA',
      overflow: 'hidden' as const,
      backgroundColor: colors.cardBackground ?? '#FFFFFF',
      padding: finalConfig.padding,
    },
    fallback: {
      borderRadius: finalConfig.borderRadius,
      backgroundColor: colors.cardBackground ?? '#FFFFFF',
      borderColor: colors.border ?? '#EAEAEA',
      overflow: 'hidden' as const,
    },
  };
};

/**
 * Creates common content container styles for cards
 */
export const createCardContentStyles = (theme: Theme, gapKey: any = '3') => ({
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: getSpacing(theme, gapKey),
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
    borderRadius: borderRadius ?? (theme as any)?.borderRadius?.base ?? size / 2,
    backgroundColor: (theme as any)?.colors?.surface ?? '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

/**
 * Creates common text container styles
 */
export const createTextContainerStyles = (theme: Theme, gapKey: any = '1') => ({
  textContainer: {
    flex: 1,
    gap: getSpacing(theme, gapKey),
  },
});
