/**
 * Common screen style utilities to reduce duplication across screens
 * This file contains shared style patterns used throughout the app
 */
import {useMemo} from 'react';
import {StyleSheet} from 'react-native';

/**
 * Creates standard container styles for screens
 * Use this for basic screen layouts with ScrollView or View
 */
export const createScreenContainerStyles = (theme: any) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing['4'],
    paddingBottom: theme.spacing['6'],
  },
});

/**
 * Creates error display styles
 * Use for error states and messages
 */
export const createErrorContainerStyles = (theme: any) => ({
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing['4'],
  },
  errorText: {
    ...theme.typography.bodyLarge,
    color: theme.colors.error,
    textAlign: 'center' as const,
  },
});

/**
 * Creates empty state styles
 * Use for screens with no data
 */
export const createEmptyStateStyles = (theme: any) => ({
  emptyContainer: {
    paddingVertical: theme.spacing['4'],
    alignItems: 'center' as const,
  },
  emptyText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
  emptyStateContainer: {
    marginHorizontal: theme.spacing['4'],
    marginVertical: theme.spacing['8'],
    paddingVertical: theme.spacing['10'],
    paddingHorizontal: theme.spacing['4'],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyStateTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    marginBottom: theme.spacing['2'],
    fontWeight: '600' as const,
  },
  emptyStateText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
});

/**
 * Creates common spacing styles for search bar and companion selector
 */
export const createSearchAndSelectorStyles = (theme: any) => ({
  searchBar: {
    marginBottom: theme.spacing['2'],
    marginInline: theme.spacing['6'],
  },
  companionSelector: {
    marginTop: theme.spacing['2'],
    marginBottom: theme.spacing['4'],
  },
  companionSelectorTask: {
    marginTop: theme.spacing['4'],
    marginBottom: theme.spacing['4'],
    paddingHorizontal: theme.spacing['4'],
  },
});

/**
 * Creates common liquid glass header styles
 * Use this for the "top liquid glass" pattern where scroll content sits behind the glass
 * @see apps/mobileAppYC/guides/liquidGlassHeaderGuide.md
 */
type LiquidGlassHeaderOptions = {
  cardGap?: number;
};

export const createLiquidGlassHeaderStyles = (
  theme: any,
  options: LiquidGlassHeaderOptions = {},
) => {
  const {cardGap} = options;

  return {
    topSection: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      backgroundColor: 'transparent',
    },
    topGlassShadowWrapper: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      shadowColor: theme.colors.neutralShadow ?? '#000000',
      shadowOffset: {width: 0, height: 12},
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 10,
      backgroundColor: 'transparent',
    },
    topGlassCard: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: theme.spacing['3'],
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'visible' as const,
      ...(cardGap ? {gap: cardGap} : null),
    },
    topGlassFallback: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      borderWidth: 0,
      borderColor: 'transparent',
    },
  };
};

/**
 * Creates common glass card styles
 * Use for standard liquid glass cards
 */
export const createGlassCardStyles = (theme: any) => ({
  glassShadowWrapper: {
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  glassContainer: {
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing['2'],
    overflow: 'visible' as const,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  glassFallback: {
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 0,
    borderColor: 'transparent',
  },
});

/**
 * Creates common status card styles
 * Use for loading, error, and info cards
 */
export const createStatusCardStyles = (theme: any) => ({
  statusCard: {
    gap: theme.spacing['2'],
    padding: theme.spacing['4'],
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center' as const,
  },
  statusTitle: {
    ...theme.typography.subtitleBold14,
    color: theme.colors.text,
  },
  statusText: {
    ...theme.typography.subtitleRegular14,
    color: theme.colors.textSecondary,
  },
  cardFallback: {
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
  },
});

/**
 * Creates common info card styles
 * Use for information display cards
 */
export const createInfoCardStyles = (theme: any) => ({
  infoCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['4'],
    marginTop: theme.spacing['2'],
    marginBottom: theme.spacing['4'],
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
  },
  infoTitle: {
    ...theme.typography.titleLarge,
    color: theme.colors.secondary,
    marginBottom: theme.spacing['2'],
  },
  infoText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['1'],
  },
});

/**
 * Creates common section styles
 * Use for category or content sections
 */
export const createSectionStyles = (theme: any) => ({
  section: {
    marginBottom: theme.spacing['4'],
  },
  sectionTitle: {
    ...theme.typography.titleLarge,
    color: theme.colors.secondary,
    marginBottom: theme.spacing['3'],
  },
  categorySection: {
    marginBottom: theme.spacing['6'],
    paddingHorizontal: theme.spacing['4'],
  },
  categoryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: theme.spacing['3'],
  },
  categoryTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    fontWeight: '600' as const,
  },
  categoryTile: {
    width: '100%' as const,
  },
});

/**
 * Creates common card item styles
 * Use for list items and card-based content
 */
export const createCardItemStyles = (theme: any) => ({
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    paddingVertical: theme.spacing['6'],
    paddingHorizontal: theme.spacing['4'],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  accordionItem: {
    width: '100%' as const,
  },
});

/**
 * Complete style collection - use this when you need all common styles
 * Includes all shared patterns in one object
 */
export const createAllCommonStyles = (theme: any) => ({
  ...createScreenContainerStyles(theme),
  ...createErrorContainerStyles(theme),
  ...createEmptyStateStyles(theme),
  ...createSearchAndSelectorStyles(theme),
  ...createStatusCardStyles(theme),
  ...createInfoCardStyles(theme),
  ...createSectionStyles(theme),
  ...createCardItemStyles(theme),
});

/**
 * Custom hook to create and memoize screen styles
 * Eliminates the duplicate pattern: const styles = useMemo(() => createStyles(theme), [theme])
 *
 * Usage:
 * ```tsx
 * const styles = useScreenStyles(theme => ({
 *   container: { flex: 1, backgroundColor: theme.colors.background },
 *   title: { ...theme.typography.h1, color: theme.colors.text }
 * }));
 * ```
 */
export const useScreenStyles = <T extends Record<string, any>>(
  createStylesFn: (theme: any) => T,
  theme: any,
): T => {
  return useMemo(() => createStylesFn(theme), [createStylesFn, theme]);
};

/**
 * Hook to create styles with common patterns included
 * Combines common styles with custom styles
 *
 * Usage:
 * ```tsx
 * const styles = useCommonScreenStyles(theme, theme => ({
 *   customStyle: { marginTop: theme.spacing['4'] }
 * }));
 * // Now you have access to both common styles and custom styles
 * ```
 */
export const useCommonScreenStyles = <T extends Record<string, any>>(
  theme: any,
  createCustomStylesFn?: (theme: any) => T,
) => {
  return useMemo(() => {
    const commonStyles = createAllCommonStyles(theme);
    const customStyles = createCustomStylesFn ? createCustomStylesFn(theme) : {};
    return StyleSheet.create({
      ...commonStyles,
      ...customStyles,
    });
  }, [theme, createCustomStylesFn]);
};
