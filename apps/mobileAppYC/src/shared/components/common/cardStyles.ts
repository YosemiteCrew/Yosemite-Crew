import {StyleSheet} from 'react-native';

export const ACTION_WIDTH = 65;
export const OVERLAP_WIDTH = 12;
export const TOTAL_ACTION_WIDTH = ACTION_WIDTH * 2;

// Helper functions for dynamic styles
export const getActionWrapperStyle = (showEditAction: boolean, theme: any) => ({
  flexDirection: 'row' as const,
  height: '100%' as const,
  width: '100%' as const,
  backgroundColor: showEditAction ? theme.colors.primary : theme.colors.success,
  borderTopRightRadius: theme.borderRadius.lg,
  borderBottomRightRadius: theme.borderRadius.lg,
  overflow: 'hidden' as const,
});

export const getEditActionButtonStyle = (theme: any) => ({
  backgroundColor: theme.colors.primary,
});

export const getViewActionButtonStyle = (theme: any) => ({
  backgroundColor: theme.colors.success,
  borderTopRightRadius: theme.borderRadius.lg,
  borderBottomRightRadius: theme.borderRadius.lg,
});

export const createCardStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
      marginBottom: theme.spacing['4'],
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['4'],
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['4'],
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
    },
    hiddenActionContainer: {
      width: 0,
    },
    overlapContainer: {
      height: '100%',
    },
    actionButton: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionIcon: {
      width: theme.spacing['7'],
      height: theme.spacing['7'],
      resizeMode: 'contain' as const,
    },
    innerContent: {
      width: '100%',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    thumbnailContainer: {
      width: theme.spacing['14'],
      height: theme.spacing['14'],
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden' as const,
      backgroundColor: theme.colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover' as const,
    },
    textContent: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    title: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    rightColumn: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      minWidth: theme.spacing['18'],
    },
    amount: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
    },
  });
