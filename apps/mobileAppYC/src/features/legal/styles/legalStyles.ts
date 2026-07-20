import {StyleSheet, Platform} from 'react-native';

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
      paddingBottom: theme.spacing['10'],
      gap: theme.spacing['4'],
    },
    titleBlock: {
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['1'],
    },
    displayTitle: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
    },
    updatedPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 11,
      borderRadius: 9999,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    updatedDot: {
      width: 6,
      height: 6,
      borderRadius: 9999,
      backgroundColor: theme.colors.success,
    },
    updatedPillText: {
      fontFamily: theme.typography.SATOSHI_MEDIUM,
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.inkMuted,
    },
    navChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: theme.spacing['1'],
    },
    navChip: {
      paddingVertical: 7,
      paddingHorizontal: 13,
      borderRadius: 9999,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    navChipActive: {
      backgroundColor: theme.colors.cta,
      borderColor: theme.colors.cta,
    },
    navChipText: {
      fontFamily: theme.typography.SATOSHI_MEDIUM,
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.inkMuted,
    },
    navChipTextActive: {
      color: theme.colors.ctaText,
      fontWeight: '600',
    },
    downloadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      marginTop: theme.spacing['2'],
    },
    downloadButtonText: {
      fontFamily: theme.typography.SATOSHI_MEDIUM,
      fontSize: 14.5,
      fontWeight: '500',
      color: theme.colors.inkBody,
    },
    withdrawalCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.borderMuted,
      boxShadow: `0px 1px 6px ${theme.colors.neutralShadow}`,
    },
    withdrawalCard: {
      gap: theme.spacing['4'],
    },
    formHeader: {
      gap: theme.spacing['1'],
    },
    formTitle: {
      // Subtitle Bold 14
      fontFamily:
        theme.typography.subtitleBold14?.fontFamily ||
        theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleBold14?.fontSize || 14,
      lineHeight: theme.typography.subtitleBold14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleBold14?.fontWeight || '700',
      color: theme.colors.text,
      overflow: 'hidden',
    },
    formSubtitle: {
      // Subtitle Regular 14 with 2-line clamp equivalent (handled via numberOfLines in JSX)
      fontFamily:
        theme.typography.subtitleRegular14?.fontFamily ||
        theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
      overflow: 'hidden',
    },
    checkboxLabel: {
      fontFamily:
        theme.typography.subtitleRegular14?.fontFamily ||
        theme.typography.SATOSHI_REGULAR,
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
      ...theme.typography.labelXxsBold,
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
      fontFamily:
        theme.typography.subtitleRegular14?.fontFamily ||
        theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
      textAlign: 'center',
    },
    formFooterInlineBold: {
      fontFamily:
        theme.typography.subtitleRegular14?.fontFamily ||
        theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    formFooterEmail: {
      fontFamily:
        theme.typography.subtitleRegular14?.fontFamily ||
        theme.typography.SATOSHI_BOLD,
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
      ...theme.typography.titleSmall,
      color: theme.colors.white,
      textAlign: 'center',
    },
  });
