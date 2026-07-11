import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Easing,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useTheme} from '@/hooks';

// Shimmer pulse: opacity 1 -> 0.45 -> 1 over ~1.4s (two 700ms halves), matching
// the warm-bone `ycPulse` keyframe. A per-block start delay staggers a group of
// blocks into a wave. When reduced motion is on the block holds a static tint.
const PULSE_MIN = 0.45;
const PULSE_MAX = 1;
const PULSE_STATIC = 0.75;
const HALF_CYCLE_MS = 700;

export interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  /** Start delay (ms) so a group of blocks pulses as a staggered wave. */
  delay?: number;
  /** When true, animation is skipped and a static tint is shown. */
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = '100%',
  height = 12,
  radius = 8,
  delay = 0,
  reduceMotion = false,
  style,
}) => {
  const {theme} = useTheme();
  const opacity = useRef(new Animated.Value(PULSE_MAX)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(PULSE_STATIC);
      return;
    }

    opacity.setValue(PULSE_MAX);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PULSE_MIN,
          duration: HALF_CYCLE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: PULSE_MAX,
          duration: HALF_CYCLE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [opacity, delay, reduceMotion]);

  const fillStyle = useMemo<ViewStyle>(
    () => ({
      width,
      height,
      borderRadius: radius,
      backgroundColor: theme.colors.inset,
    }),
    [width, height, radius, theme.colors.inset],
  );

  return <Animated.View style={[fillStyle, {opacity}, style]} />;
};
