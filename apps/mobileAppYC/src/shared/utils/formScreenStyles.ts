import {StyleSheet} from 'react-native';
import {createScreenContainerStyles} from '@/shared/utils/screenStyles';
import {createCenteredStyle} from '@/shared/utils/commonHelpers';
import type {Theme} from '@/theme/themes';

export const createFormScreenStyles = (theme: Theme) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    ...createCenteredStyle(theme),
    content: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['10'],
    },
    glassContainer: {
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing['2'],
      overflow: 'hidden',
      ...theme.shadows.sm,
    },
    glassFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
    },
    listContainer: {
      gap: theme.spacing['1'],
    },
    muted: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['20'],
    },
    formSection: {
      marginBottom: theme.spacing['5'],
      gap: theme.spacing['4'],
    },
    inputContainer: {
      marginBottom: 0,
    },
    fieldGroup: {
      gap: theme.spacing['3'],
      paddingBottom: theme.spacing['1.25'],
    },
    fieldLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
    },
    dropdownIcon: {
      width: theme.spacing['3'],
      height: theme.spacing['3'],
      marginLeft: theme.spacing['2'],
      tintColor: theme.colors.textSecondary,
    },
    calendarIcon: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      tintColor: theme.colors.textSecondary,
    },
    errorText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.error,
      marginTop: theme.spacing['1'],
      marginBottom: theme.spacing['3'],
      marginLeft: theme.spacing['1'],
    },
    submissionError: {
      ...theme.typography.paragraphBold,
      color: theme.colors.error,
      textAlign: 'center',
      paddingHorizontal: theme.spacing['5'],
      marginBottom: theme.spacing['2'],
    },
    buttonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['4'],
      paddingBottom: theme.spacing['4'],
      backgroundColor: theme.colors.background,
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.whiteOverlay70,
      ...theme.shadows.lg,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });
