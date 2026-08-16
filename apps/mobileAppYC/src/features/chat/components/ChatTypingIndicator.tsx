/**
 * ChatTypingIndicator
 *
 * Warm-bone typing indicator for the appointment chat. Wired in as the Stream
 * Chat `TypingIndicator`, so it is only mounted (by the default
 * `TypingIndicatorContainer`) while the other party is actually typing. Renders
 * a receiver-side bubble with three bouncing dots; the bounce honours the OS
 * reduce-motion setting.
 */

import React, {useEffect, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

const DOT_DELAYS = [0, 150, 300];

const TypingDot: React.FC<{delay: number; color: string}> = ({
  delay,
  color,
}) => {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, {duration: 600}), -1, true),
    );
  }, [delay, progress, reducedMotion]);

  const dotStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {opacity: 1, transform: [{translateY: 0}]};
    }
    return {
      opacity: 0.35 + 0.65 * progress.value,
      transform: [{translateY: -4 * progress.value}],
    };
  });

  return (
    <Animated.View style={[styles.dot, {backgroundColor: color}, dotStyle]} />
  );
};

export const ChatTypingIndicator: React.FC = () => {
  const {theme} = useTheme();
  const containerStyles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={containerStyles.wrapper} pointerEvents="none">
      <View
        style={containerStyles.bubble}
        accessible
        accessibilityLabel="typing"
        testID="typing-indicator">
        {DOT_DELAYS.map(delay => (
          <TypingDot key={delay} delay={delay} color={theme.colors.inkFaint} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      alignItems: 'flex-start',
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['2.5'],
    },
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderTopLeftRadius: theme.borderRadius.cardSmall,
      borderTopRightRadius: theme.borderRadius.cardSmall,
      borderBottomRightRadius: theme.borderRadius.cardSmall,
      borderBottomLeftRadius: 6,
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['4'],
    },
  });

export default ChatTypingIndicator;
