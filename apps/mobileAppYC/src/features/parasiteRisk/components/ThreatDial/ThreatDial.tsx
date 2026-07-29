import React, {useEffect} from 'react';
import {View, Text, StyleSheet, AccessibilityInfo} from 'react-native';
import Svg, {Circle, G} from 'react-native-svg';
import Reanimated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks';
import {fonts} from '@/theme/typography';
import {durations, easings} from '@/theme/motion';
import type {RiskTier} from '../../types';
import {TIER_PRESENTATION} from '../../utils/riskPresentation';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

const SIZE = 208;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Open-bottom gauge: 260 degrees of sweep with the gap at the bottom. */
const SWEEP_RATIO = 260 / 360;
const ARC_LENGTH = CIRCUMFERENCE * SWEEP_RATIO;
/** Rotate so the gap sits symmetrically at the bottom. */
const START_ANGLE = 90 + (360 - 260) / 2;

interface ThreatDialProps {
  tier: RiskTier;
  /** 0-100 modelled index. */
  index: number;
  /** Written tier label, already localised. */
  tierLabel: string;
  /** Short caption under the number, already localised. */
  caption?: string;
}

/**
 * The headline gauge.
 *
 * The tier is encoded three ways at once - arc length, colour, and the written
 * label underneath - so the reading survives colour-blindness and greyscale.
 */
export const ThreatDial: React.FC<ThreatDialProps> = ({
  tier,
  index,
  tierLabel,
  caption,
}) => {
  const {theme} = useTheme();
  const presentation = TIER_PRESENTATION[tier];
  const progress = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;

    // Honour the OS reduce-motion setting: land on the final value instead of
    // sweeping to it.
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotion => {
        if (cancelled) return;
        progress.value = reduceMotion
          ? presentation.fill
          : withTiming(presentation.fill, {
              duration: durations.slow,
              easing: Easing.bezier(...easings.easeOut),
            });
      })
      .catch(() => {
        if (!cancelled) progress.value = presentation.fill;
      });

    return () => {
      cancelled = true;
    };
  }, [presentation.fill, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - progress.value),
  }));

  const accentColor = theme.colors[presentation.color];

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${tierLabel}. Modelled risk index ${index} out of 100.`}>
      <Svg width={SIZE} height={SIZE}>
        <G rotation={START_ANGLE} originX={SIZE / 2} originY={SIZE / 2}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={theme.colors.borderSeparator}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={accentColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>

      <View style={styles.readout} pointerEvents="none">
        <Text
          style={[styles.tier, {color: accentColor}]}
          numberOfLines={2}
          adjustsFontSizeToFit>
          {tierLabel}
        </Text>
        {caption ? (
          <Text style={[styles.caption, {color: theme.colors.inkMuted}]}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  readout: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  tier: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 26,
    lineHeight: 30,
    textAlign: 'center',
  },
  caption: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },
});
