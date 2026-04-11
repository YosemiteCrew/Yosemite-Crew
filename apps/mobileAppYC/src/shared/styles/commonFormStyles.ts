import {StyleSheet} from 'react-native';

export const createCommonFormStyles = (theme: any) =>
  StyleSheet.create({
    dropdownIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    calendarIcon: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      tintColor: theme.colors.textSecondary,
    },
  });

