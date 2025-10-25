import {StyleSheet} from 'react-native';

export const createTaskFormStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      gap: theme.spacing[5],
    },
    companionSelector: {
      marginTop: theme.spacing[2],
      marginBottom: theme.spacing[4],
    },
    fieldGroup: {
      gap: theme.spacing[3],
    },
    dropdownIcon: {
      width: 20,
      height: 20,
      tintColor: theme.colors.secondary,
    },
    toggleSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
    },
    toggleLabel: {
      ...theme.typography.bodyMedium,
      color: theme.colors.text,
      fontWeight: '600',
    },
    footer: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      backgroundColor: theme.colors.background,
    },
    saveButton: {
      flex: 1,
    },
    saveButtonText: {
      ...theme.typography.labelLarge,
      color: theme.colors.white,
      fontWeight: '600',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[4],
    },
    errorText: {
      ...theme.typography.bodyLarge,
      color: theme.colors.error,
      textAlign: 'center',
    },
  });
