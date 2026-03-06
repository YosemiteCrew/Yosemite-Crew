import {StyleSheet} from 'react-native';

/**
 * Common styles shared across Co-Parent screens
 */
export const createCommonCoParentStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.lg,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.titleMedium,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
