import React, {useMemo} from 'react';
import {View, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import type {Theme} from '@/theme';
import {useTheme} from '@/hooks';
import {SkeletonBlock} from './SkeletonBlock';
import {useReducedMotion} from './useReducedMotion';

export interface SkeletonListProps {
  /** Number of placeholder list rows. */
  rows?: number;
  /** Show the leading title bar + round action placeholder. */
  showHeader?: boolean;
  /** Show the filter-chip pill row. */
  showFilters?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const FILTER_DELAYS = [0, 120, 240];

/**
 * Loading placeholder for a list screen: an optional title row and filter-chip
 * row above a stack of avatar + two-line rows. Rows recede toward the bottom
 * (dimmed) to imply a longer list, and each block pulses on a staggered delay.
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  rows = 5,
  showHeader = true,
  showFilters = true,
  style,
  testID,
}) => {
  const {theme} = useTheme();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rowItems = useMemo(
    () =>
      Array.from({length: rows}, (_, index) => {
        const isSecondLast = index === rows - 2;
        const isLast = index === rows - 1;
        const rowDim = isLast ? 0.4 : isSecondLast ? 0.7 : 1;
        return {
          key: `skeleton-row-${index}`,
          opacity: rowDim,
          baseDelay: 80 + index * 80,
        };
      }),
    [rows],
  );

  return (
    <View style={[styles.container, style]} testID={testID}>
      {showHeader && (
        <View style={styles.titleRow}>
          <SkeletonBlock
            width={168}
            height={28}
            radius={9}
            delay={80}
            reduceMotion={reduceMotion}
          />
          <SkeletonBlock
            width={42}
            height={42}
            radius={theme.borderRadius.chip}
            delay={140}
            reduceMotion={reduceMotion}
          />
        </View>
      )}

      {showFilters && (
        <View style={styles.filterRow}>
          {FILTER_DELAYS.map(delay => (
            <SkeletonBlock
              key={delay}
              width={84}
              height={34}
              radius={theme.borderRadius.chip}
              delay={delay}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>
      )}

      <View style={styles.rows}>
        {rowItems.map(item => (
          <View
            key={item.key}
            style={[styles.rowCard, {opacity: item.opacity}]}>
            <SkeletonBlock
              width={42}
              height={42}
              radius={13}
              delay={item.baseDelay}
              reduceMotion={reduceMotion}
            />
            <View style={styles.rowText}>
              <SkeletonBlock
                width="70%"
                height={13}
                radius={7}
                delay={item.baseDelay + 40}
                reduceMotion={reduceMotion}
              />
              <SkeletonBlock
                width="45%"
                height={10}
                radius={5}
                delay={item.baseDelay + 80}
                reduceMotion={reduceMotion}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['3.5'],
    },
    filterRow: {
      flexDirection: 'row',
      gap: theme.spacing['2'],
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['4'],
      paddingBottom: theme.spacing['1'],
    },
    rows: {
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['3.5'],
      gap: 11,
    },
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['4'],
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.cardSmall,
    },
    rowText: {
      flex: 1,
      gap: theme.spacing['2'],
    },
  });
