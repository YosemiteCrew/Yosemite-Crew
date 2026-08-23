import {StyleSheet} from 'react-native';

export const createPassportStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['32'],
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['6'],
    },
    errorText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.dangerText,
      textAlign: 'center',
    },
    emptyText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    emptySectionText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      paddingVertical: theme.spacing['3'],
    },
    // cardBackground (#FFFFFF) is nearly identical to the screen background
    // (#FFFEFE), so a background colour alone doesn't visually separate this
    // from the page - added the same border SubcategoryAccordion already
    // uses, so identity/issuing/uploads read as distinct cards too.
    identityCard: {
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginTop: theme.spacing['4'],
    },
    identityPhoto: {
      width: theme.spacing['20'],
      height: theme.spacing['20'],
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing['3'],
    },
    walletRow: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['4'],
    },
    // Matches the "Get Directions" button in BusinessDetailsScreen.tsx for
    // everything except font size: that button is full-width with a short
    // label ("Get Directions"), these are flex:1 side by side with longer
    // labels ("Add to Apple Wallet"), so `cta` (18px) was clipping - sized
    // down to buttonSmall so the full label fits without wrapping/clipping.
    walletButton: {
      flex: 1,
    },
    walletButtonText: {
      ...theme.typography.buttonSmall,
      color: theme.colors.white,
    },
    identityName: {
      ...theme.typography.h4,
      color: theme.colors.text,
    },
    identitySubtitle: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing['3'],
    },
    sectionHeading: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      marginBottom: theme.spacing['2'],
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['1'],
    },
    infoLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    infoValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '600',
    },
    accordionItem: {
      marginTop: theme.spacing['3'],
    },
    recordRow: {
      paddingVertical: theme.spacing['2'],
    },
    // Applied to every row except the last in a section, so a lone/final
    // record doesn't show a dangling divider with nothing below it.
    recordRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderMuted,
    },
    recordTitle: {
      ...theme.typography.labelLarge,
      color: theme.colors.text,
      marginBottom: theme.spacing['1'],
    },
    uploadsCard: {
      marginBottom: theme.spacing['4'],
    },
    uploadsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    uploadIcon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
      // addIconDark is a dark glyph. Header tints its right icon for exactly
      // this reason; this one sits inside a card and was missed, so the upload
      // action rendered #302F2E on a #25211E disc - 1.20:1 - in dark mode.
      tintColor: theme.colors.text,
    },
    uploadsHint: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing['1'],
      marginBottom: theme.spacing['2'],
    },
    // Matches the pending-status chip pattern already used in
    // features/tasks/components/TaskCard/TaskCard.tsx (pendingBadge/pendingText).
    pendingBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.warningSurface,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      marginTop: theme.spacing['1'],
    },
    pendingBadgeText: {
      ...theme.typography.labelSmall,
      color: theme.colors.warning,
    },
  });
