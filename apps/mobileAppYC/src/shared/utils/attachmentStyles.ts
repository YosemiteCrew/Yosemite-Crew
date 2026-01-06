import {StyleSheet, Platform} from 'react-native';
import type {Theme} from '@/theme/themes';

export const createAttachmentStyles = (theme: Theme) =>
  StyleSheet.create({
    emptyStateContainer: {
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing['8'],
      paddingHorizontal: theme.spacing['4'],
      alignItems: 'center',
      gap: theme.spacing['2'],

    },
    emptyStateIcon: {
      width: theme.spacing['16'],
      height: theme.spacing['16'],
      resizeMode: 'contain',
    },
    emptyStateTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    emptyStateSubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    container: {gap: theme.spacing['4']},
    previewCard: {
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      width: '100%',
      gap: theme.spacing['3'],
    },
    previewCardHeader: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewImage: {
      width: '100%',
      height: theme.spacing['96'],
      paddingBlock: theme.spacing['2'],
      borderRadius: theme.borderRadius.base,
    },
    pdfPlaceholder: {
      width: '100%',
      height: theme.spacing['72'],
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['2'],
    },
    pdfIcon: {
      width: theme.spacing['16'],
      height: theme.spacing['16'],
      resizeMode: 'contain',
      marginBottom: theme.spacing['3'],
    },
    pdfLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    pageIndicator: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
    },
    actionRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.spacing['4'],
      marginTop: theme.spacing['2'],
    },
    shareButton: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.spacing['6'],
      backgroundColor: theme.colors.primary,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['2'],
      ...theme.shadows.sm,
    },
    downloadButton: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.spacing['6'],
      backgroundColor: theme.colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['2'],
      ...theme.shadows.sm,
    },
    shareIcon: {
      width: theme.spacing['7'],
      height: theme.spacing['7'],
      resizeMode: 'contain',
      tintColor: theme.colors.white,
    },
    downloadIcon: {
      width: theme.spacing['7'],
      height: theme.spacing['7'],
      resizeMode: 'contain',
      tintColor: theme.colors.white,
    },
    previewContentCard: {
      width: '100%',
    },
    previewContentFallback: {

      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.base,
      shadowColor: theme.colors.neutralShadow,
      width: '100%',
    },
  });

export default createAttachmentStyles;
