// src/shared/styles/stateBlockStyles.ts
//
// The shared warm-bone "state block": a 104pt icon ring, a serif title, muted
// body copy and one pill CTA. EmptyState and ListErrorState are the same object
// wearing different colours, and they used to carry two byte-identical copies of
// this StyleSheet. One factory, two callers.

import {StyleSheet} from 'react-native';

import type {Theme} from '@/theme';

export interface StateBlockStyleOptions {
  /** Fill behind the icon. Blue-soft for an empty state, danger for an error. */
  ringColor: string;
  /**
   * Vertical padding on the outer container. Errors sit inline in a scroll view
   * and need it; a full-screen empty state does not, and omits the key.
   */
  paddingVertical?: number;
}

export const createStateBlockStyles = (
  theme: Theme,
  {ringColor, paddingVertical}: StateBlockStyleOptions,
) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['5'],
      // Omitted rather than set to 0 when unused, so a caller that never wanted
      // vertical padding produces the same style object it always did.
      ...(paddingVertical ? {paddingVertical} : {}),
    },
    ring: {
      width: 104,
      height: 104,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: ringColor,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing['5'],
    },
    title: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    description: {
      ...theme.typography.bodySmall,
      fontSize: 14.5,
      color: theme.colors.inkMuted,
      textAlign: 'center',
      marginTop: theme.spacing['2'],
    },
    cta: {
      minHeight: 54,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.cta,
      paddingHorizontal: theme.spacing['7'],
      marginTop: theme.spacing['6'],
    },
    ctaLabel: {
      ...theme.typography.button,
      fontSize: 16.5,
      color: theme.colors.ctaText,
    },
  });
