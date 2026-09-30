import type {Theme} from '@/theme';

/** Layout shared by the companion list screens: loading, error with retry, intro and empty text. */
export const companionListScreenStyles = (theme: Theme) =>
  ({
    content: {padding: theme.spacing['5'], paddingBottom: theme.spacing['10']},
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing['5'],
    },
    intro: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
      marginBottom: theme.spacing['5'],
    },
    empty: {...theme.typography.body, color: theme.colors.inkMuted},
    error: {
      ...theme.typography.body,
      color: theme.colors.dangerText,
      textAlign: 'center',
    },
    button: {
      marginTop: theme.spacing['4'],
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.blueText,
      alignSelf: 'flex-start',
    },
    buttonLabel: {...theme.typography.button, color: theme.colors.white},
  }) as const;
