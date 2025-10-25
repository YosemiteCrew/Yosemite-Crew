import {StyleSheet} from 'react-native';

export const createTaskFormStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingBlock: theme.spacing[4],
    },
    companionSelector: {
      marginBottom: theme.spacing[4],
    },
    fieldGroup: {
      marginBottom: theme.spacing[4],
    },
    dropdownIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    calendarIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
    toggleSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing[4],
    },
    toggleLabel: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    reminderPillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[4],
    },
    reminderPill: {
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      borderWidth: 0.5,
      borderColor: '#312943',
    },
    reminderPillSelected: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderColor: theme.colors.primary,
    },
    reminderPillText: {
      ...theme.typography.bodySmall,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    reminderPillTextSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
      marginBottom: theme.spacing[4],
    },
    dateTimeField: {
      flex: 1,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    footer: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[6],
      paddingTop: theme.spacing[2],
      backgroundColor: theme.colors.background,
    },
    saveButton: {
      width: '100%',
      marginTop: theme.spacing[4],
    },
    saveButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
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
