import {StyleSheet} from 'react-native';
import type {Theme} from '@/theme';

/**
 * Shared layout for the "add a companion first" gate screens: a full-height
 * screen-colored safe area with a centered empty state.
 */
export const createEmptyGateScreenStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.screen,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.screen,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
