// src/shared/components/common/InkEncircle/InkEncircle.tsx
//
// Hand-drawn "ink" ellipse that strokes itself around content, matching the
// warm-bone encircle motion (pink stroke, ~1550ms, ink easing). Reserved for
// the splash screen brand moment. Uses a direct pink token (not useTheme) so it
// is safe to render before the theme/Redux providers mount.

import React, {useEffect} from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Ellipse} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {colors} from '@/theme';
import {motion} from '@/theme/motion';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

export interface InkEncircleProps {
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Ramanujan approximation of an ellipse circumference. */
const ellipsePerimeter = (rx: number, ry: number): number =>
  Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));

export const InkEncircle: React.FC<InkEncircleProps> = ({
  width,
  height,
  color = colors.pink,
  strokeWidth = motion.encircle.strokeWidth,
  duration = motion.encircle.duration,
  delay = motion.encircle.delay,
  style,
  testID,
}) => {
  const rx = width / 2 - strokeWidth;
  const ry = height / 2 - strokeWidth;
  const perimeter = ellipsePerimeter(rx, ry);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.bezier(...motion.encircle.easing),
      }),
    );
  }, [progress, delay, duration]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: perimeter * (1 - progress.value),
  }));

  return (
    <View
      pointerEvents="none"
      style={[styles.container, style]}
      testID={testID}>
      <Svg width={width} height={height}>
        <AnimatedEllipse
          cx={width / 2}
          cy={height / 2}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={perimeter}
          animatedProps={animatedProps}
          transform={`rotate(-8 ${width / 2} ${height / 2})`}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
