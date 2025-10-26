import {StyleSheet} from 'react-native';

export const createTaskFormSectionStyles = (theme: any) =>
  StyleSheet.create({
    fieldGroup: {
      marginBottom: theme.spacing[4],
    },
    calendarIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
      marginBottom: theme.spacing[4],
    },
    dateTimeField: {
      flex: 1,
    },
  });
