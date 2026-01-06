import {StyleSheet} from 'react-native';
import {createFormStyles} from '@/shared/utils/formStyles';
import {createScreenContainerStyles, createErrorContainerStyles, createSearchAndSelectorStyles} from '@/shared/utils/screenStyles';

export const createTaskFormStyles = (theme: any) => {
  const formStyles = createFormStyles(theme);
  const screenStyles = createScreenContainerStyles(theme);
  const errorStyles = createErrorContainerStyles(theme);
  const selectorStyles = createSearchAndSelectorStyles(theme);

  return StyleSheet.create({
    ...screenStyles,
    ...errorStyles,
    ...selectorStyles,
    contentContainer: {
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['20'],
    },
    ...formStyles,
    input: {
      marginBottom: theme.spacing['4'],
    },
    label: {
      ...theme.typography.inputLabel,
      color: theme.colors.secondary,
    },
    footer: {
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['6'] + 10,
      paddingTop: theme.spacing['2'],
      backgroundColor: theme.colors.background,
    },
    saveButton: {
      width: '100%' as const,
      marginTop: theme.spacing['4'],
    },
    saveButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
    errorText: errorStyles.errorText,
  });
};
