import {StyleSheet} from 'react-native';

export const createAttachmentStyles = (theme: any) =>
  StyleSheet.create({
  container: {gap: theme.spacing[4]},
    previewCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[4],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      alignItems: 'center',
    },
    previewImage: {
      width: '100%',
      height: 400,
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing[2],
    },
    pdfPlaceholder: {
      width: '100%',
      height: 300,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing[2],
    },
    pdfIcon: {
      width: 64,
      height: 64,
      resizeMode: 'contain',
      marginBottom: theme.spacing[3],
    },
    pdfLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    pageIndicator: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
    },
    shareButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing[2],
      ...theme.shadows.lg,
    },
    shareIcon: {
      width: 28,
      height: 28,
      resizeMode: 'contain',
      tintColor: theme.colors.white,
    },
  });

export default createAttachmentStyles;
