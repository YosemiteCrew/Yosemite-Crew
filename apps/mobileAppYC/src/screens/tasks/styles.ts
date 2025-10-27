import {StyleSheet} from 'react-native';
import {createFormStyles} from '@/utils/formStyles';

export const createTaskFormStyles = (theme: any) => {
  const formStyles = createFormStyles(theme);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingBlock: theme.spacing[4],
    },
    companionSelector: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[4],
    },
    ...formStyles,
    input: {
      marginBottom: theme.spacing[4],
    },
    label: {
      ...theme.typography.inputLabel,
      color: theme.colors.secondary,
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
    errorContainerText: {
      ...theme.typography.bodyLarge,
      color: theme.colors.error,
      textAlign: 'center',
    },
  });
};
