import {StyleSheet} from 'react-native';
import {createScreenContainerStyles} from '@/utils/screenStyles';
import {createCenteredStyle} from '@/utils/commonHelpers';

export const createFormScreenStyles = (theme: any) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    ...createCenteredStyle(theme),
    content: {
      paddingHorizontal: theme.spacing[5],
      paddingBottom: theme.spacing[10],
    },
    glassContainer: {
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[2],
      overflow: 'hidden',
      ...theme.shadows.md,
    },
    glassFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
    },
    listContainer: {
      gap: theme.spacing[1],
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
      paddingHorizontal: theme.spacing[5],
      paddingBottom: theme.spacing[10],
    },
    formSection: {
      marginBottom: theme.spacing[5],
      gap: theme.spacing[4],
    },
    inputContainer: {
      marginBottom: 0,
    },
    fieldGroup: {
      gap: theme.spacing[3],
      paddingBottom: 5,
    },
    fieldLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
    },
    dropdownIcon: {
      width: theme.spacing[3],
      height: theme.spacing[3],
      marginLeft: theme.spacing[2],
      tintColor: theme.colors.textSecondary,
    },
    calendarIcon: {
      width: theme.spacing[5],
      height: theme.spacing[5],
      tintColor: theme.colors.textSecondary,
    },
    errorText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
      marginTop: -theme.spacing[3],
      marginBottom: theme.spacing[3],
      marginLeft: theme.spacing[1],
    },
    submissionError: {
      ...theme.typography.paragraphBold,
      color: theme.colors.error,
      textAlign: 'center',
      paddingHorizontal: theme.spacing[5],
      marginBottom: theme.spacing[2],
    },
    buttonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: theme.spacing[5],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[4],
      backgroundColor: theme.colors.background,
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.35)',
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });
