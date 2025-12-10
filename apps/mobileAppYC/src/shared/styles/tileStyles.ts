export const baseTileContainer = (theme: any) => ({
  borderRadius: theme.borderRadius.lg,
  borderWidth: 1,
  borderColor: theme.colors.borderMuted,
  backgroundColor: theme.colors.cardBackground,
});

export const sharedTileStyles = (theme: any) => ({
  tileFallback: baseTileContainer(theme),
  tileTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
  tileSubtitle: {
    ...theme.typography.bodySmallTight,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
});
