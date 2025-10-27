import type {ViewStyle, TextStyle} from 'react-native';

/**
 * Shared form and layout style definitions to reduce duplication
 * These patterns are used consistently across all forms in the app
 */

export const createFormStyles = (theme: any) => ({
  // Standard field group spacing
  fieldGroup: {
    marginBottom: theme.spacing[4],
  } as ViewStyle,

  // Toggle section (e.g., Reminder, Calendar Sync)
  toggleSection: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[4],
  } as ViewStyle,

  // Toggle section label text
  toggleLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.secondary,
    fontWeight: '500',
  } as TextStyle,

  // Date/Time row for side-by-side date and time inputs
  dateTimeRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
  } as ViewStyle,

  // Individual date/time field
  dateTimeField: {
    flex: 1,
  } as ViewStyle,

  // Multi-line text area input
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  } as ViewStyle,

  // Reminder/tag pills container
  reminderPillsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[4],
  } as ViewStyle,

  // Individual reminder/tag pill
  reminderPill: {
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: '#312943',
  } as ViewStyle,

  // Reminder pill when selected
  reminderPillSelected: {
    backgroundColor: theme.colors.lightBlueBackground,
    borderColor: theme.colors.primary,
  } as ViewStyle,

  // Reminder pill text
  reminderPillText: {
    ...theme.typography.bodySmall,
    color: theme.colors.secondary,
    fontWeight: '500',
  } as TextStyle,

  // Reminder pill text when selected
  reminderPillTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  } as TextStyle,

  // Error text styling
  errorText: {
    ...theme.typography.labelXsBold,
    color: theme.colors.error,
    marginTop: -theme.spacing[3],
    marginBottom: theme.spacing[3],
    marginLeft: theme.spacing[1],
  } as TextStyle,
});
