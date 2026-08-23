import type {TextStyle, ViewStyle} from 'react-native';

/**
 * Shared header layout for screens with a circular back button flanking a
 * centered title/subtitle block. Returns plain style objects so callers can
 * spread them into their own StyleSheet.create and override individual keys.
 */
export const createScreenHeaderStyles = (
  theme: any,
): {
  header: ViewStyle;
  circleButton: ViewStyle;
  headerTitleBlock: ViewStyle;
  headerTitle: TextStyle;
  headerSubtitle: TextStyle;
} => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['3'],
    paddingHorizontal: theme.spacing['5'],
    paddingVertical: theme.spacing['2'],
  },
  circleButton: {
    width: theme.spacing['10'],
    height: theme.spacing['10'],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.screen2,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...theme.typography.labelSmall,
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...theme.typography.body12,
    color: theme.colors.inkMuted,
    textAlign: 'center',
    marginTop: 1,
  },
});
