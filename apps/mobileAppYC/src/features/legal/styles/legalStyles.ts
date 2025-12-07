import {StyleSheet} from 'react-native';

export const createLegalStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['3'],
      paddingBottom: theme.spacing['10'],
      gap: theme.spacing['4'],
    },
    withdrawalCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    withdrawalCard: {
      gap: theme.spacing['4'],
    },
    formHeader: {
      gap: theme.spacing['1'],
    },
    formTitle: {
      // Subtitle Bold 14
      fontFamily: theme.typography.subtitleBold14?.fontFamily || theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleBold14?.fontSize || 14,
      lineHeight: theme.typography.subtitleBold14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleBold14?.fontWeight || '700',
      color: theme.colors.text,
      overflow: 'hidden',
    },
    formSubtitle: {
      // Subtitle Regular 14 with 2-line clamp equivalent (handled via numberOfLines in JSX)
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
      overflow: 'hidden',
    },
    checkboxLabel: {
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
    },
    formFields: {
      gap: theme.spacing['3'],
    },
    textArea: {
      minHeight: 96,
    },
    formErrorText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
      marginTop: theme.spacing['1'],
      marginBottom: theme.spacing['1'],
    },
    formFooter: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    formFooterInline: {
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
      textAlign: 'center',
    },
    formFooterInlineBold: {
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    formFooterEmail: {
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      color: theme.colors.text,
      textDecorationLine: 'underline',
      textAlign: 'center',
    },
    glassButtonDark: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      minHeight: 56,
    },
    glassButtonDarkText: {
      fontFamily: theme.typography.businessTitle16.fontFamily,
      fontSize: 16,
      fontWeight: theme.typography.businessTitle16.fontWeight,
      letterSpacing: -0.16,
      lineHeight: 16,
      color: theme.colors.white,
      textAlign: 'center',
    },
  });
