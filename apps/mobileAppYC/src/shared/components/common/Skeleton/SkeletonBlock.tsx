import React, {useEffect, useMemo} from 'react';
import {
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks';

// Shimmer pulse: opacity 1 -> 0.45 -> 1 over ~1.4s (two 700ms halves), matching
// the warm-bone `ycPulse` keyframe. A per-block start delay staggers a group of
// blocks into a wave. When reduced motion is on the block holds a static tint.
// Runs on the UI thread via reanimated so the pulse never stutters on the JS
// thread while lists are scrolling.
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
  const opacity = useSharedValue(reduceMotion ? PULSE_STATIC : PULSE_MAX);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = PULSE_STATIC;
      return;
    }

    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(PULSE_MIN, {
            duration: HALF_CYCLE_MS,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(PULSE_MAX, {
            duration: HALF_CYCLE_MS,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
      ),
    );

    return () => {
      cancelAnimation(opacity);
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

  const animatedStyle = useAnimatedStyle(() => ({opacity: opacity.value}));

  return <Animated.View style={[fillStyle, animatedStyle, style]} />;
};
