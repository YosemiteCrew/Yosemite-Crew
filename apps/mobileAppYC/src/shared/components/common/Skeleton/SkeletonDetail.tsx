import React, {useMemo} from 'react';
import {View, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import type {Theme} from '@/theme';
import {useTheme} from '@/hooks';
import {SkeletonBlock} from './SkeletonBlock';
import {useReducedMotion} from './useReducedMotion';

export interface SkeletonDetailProps {
  /** Number of placeholder rows in the secondary section. */
  secondaryRows?: number;
  /** Reserve space for a pinned bottom action bar. */
  showBottomCta?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const META_ROWS = [0, 1];

/**
 * Loading placeholder for a detail screen: a hero/summary card (avatar, title,
 * badge, metadata grid, note block), a secondary section of rows, and an
 * optional pinned bottom CTA placeholder that reserves the real action's space
 * so the layout does not shift when data arrives.
 */
export const SkeletonDetail: React.FC<SkeletonDetailProps> = ({
  secondaryRows = 2,
  showBottomCta = true,
  style,
  testID,
}) => {
  const {theme} = useTheme();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const secondaryItems = useMemo(
    () => Array.from({length: secondaryRows}),
    [secondaryRows],
  );

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <SkeletonBlock
            width={44}
            height={44}
            radius={14}
            delay={100}
            reduceMotion={reduceMotion}
          />
          <View style={styles.heroHeaderText}>
            <SkeletonBlock
              width="60%"
              height={14}
              radius={7}
              delay={140}
              reduceMotion={reduceMotion}
            />
            <SkeletonBlock
              width="40%"
              height={11}
              radius={6}
              delay={180}
              reduceMotion={reduceMotion}
            />
          </View>
          <SkeletonBlock
            width={66}
            height={20}
            radius={theme.borderRadius.chip}
            delay={220}
            reduceMotion={reduceMotion}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.metaGrid}>
          {META_ROWS.map(rowIndex => (
            <View key={`meta-row-${rowIndex}`} style={styles.metaRow}>
              <SkeletonBlock
                height={12}
                radius={6}
                delay={260 + rowIndex * 60}
                reduceMotion={reduceMotion}
                style={styles.metaCell}
              />
              <SkeletonBlock
                height={12}
                radius={6}
                delay={300 + rowIndex * 60}
                reduceMotion={reduceMotion}
                style={styles.metaCell}
              />
            </View>
          ))}
        </View>

        <SkeletonBlock
          height={62}
          radius={14}
          delay={420}
          reduceMotion={reduceMotion}
        />
      </View>

      <View style={styles.secondary}>
        <SkeletonBlock
          width={120}
          height={13}
          radius={7}
          delay={460}
          reduceMotion={reduceMotion}
        />
        {secondaryItems.map((_, index) => (
          <View
            key={`secondary-row-${index}`}
            style={index > 0 ? styles.secondaryRowDim : undefined}>
            <SkeletonBlock
              height={58}
              radius={16}
              delay={500 + index * 60}
              reduceMotion={reduceMotion}
            />
          </View>
        ))}
      </View>

      {showBottomCta && (
        <View
          style={styles.bottomCta}
          pointerEvents="none"
          testID="skeleton-bottom-cta">
          <SkeletonBlock
            height={54}
            radius={theme.borderRadius.button}
            delay={300}
            reduceMotion={reduceMotion}
          />
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    heroCard: {
      marginTop: theme.spacing['4.5'],
      marginHorizontal: theme.spacing['5'],
      padding: theme.spacing['4'],
      gap: 13,
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.card,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    heroHeaderText: {
      flex: 1,
      gap: theme.spacing['2'],
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.hairline,
    },
    metaGrid: {
      gap: theme.spacing['2.5'],
    },
    metaRow: {
      flexDirection: 'row',
      gap: theme.spacing['2.5'],
    },
    metaCell: {
      flex: 1,
    },
    secondary: {
      marginTop: theme.spacing['3.5'],
      marginHorizontal: theme.spacing['5'],
      gap: 9,
    },
    secondaryRowDim: {
      opacity: 0.7,
    },
    bottomCta: {
      position: 'absolute',
      left: theme.spacing['5'],
      right: theme.spacing['5'],
      bottom: theme.spacing['6'],
    },
  });
