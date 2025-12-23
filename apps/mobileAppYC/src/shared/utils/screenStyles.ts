/**
 * Common screen style utilities to reduce duplication across screens
 */

/**
 * Creates common screen container styles
 */
export const createScreenContainerStyles = (theme: any) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing['4'],
    paddingBottom: theme.spacing['6'],
  },
});

/**
 * Creates common error display styles
 */
export const createErrorContainerStyles = (theme: any) => ({
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorText: {
    ...theme.typography.bodyLarge,
    color: theme.colors.error,
  },
});

/**
 * Creates common empty state styles
 */
export const createEmptyStateStyles = (theme: any) => ({
  emptyContainer: {
    paddingVertical: theme.spacing['4'],
    alignItems: 'center' as const,
  },
  emptyText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
});

/**
 * Creates common spacing styles for search bar and companion selector
 */
export const createSearchAndSelectorStyles = (theme: any) => ({
  searchBar: {
    marginTop: theme.spacing['4'],
    marginBottom: theme.spacing['2'],
  },
  companionSelector: {
    marginBottom: theme.spacing['4'],
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
      overflow: 'hidden' as const,
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

export const createGlassCardStyles = (theme: any) => ({
  glassShadowWrapper: {
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.md,
  },
  glassContainer: {
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing['2'],
    overflow: 'hidden' as const,
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
