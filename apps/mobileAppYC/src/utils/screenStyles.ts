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
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[6],
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
    paddingVertical: theme.spacing[4],
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
    marginTop: theme.spacing[4],
    marginBottom: theme.spacing[2],
  },
  companionSelector: {
    marginBottom: theme.spacing[4],
  },
});
