// src/shared/components/common/Toggle/Toggle.tsx
//
// Warm-bone toggle switch (48x29). Blue track when on, divider track when off,
// white knob that slides on the UI thread via reanimated. Meets the >=44pt hit
// target through the pressable padding while keeping the visual track at spec.

import React, {useEffect} from 'react';
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import {durations} from '@/theme/motion';

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TRACK_WIDTH = 48;
const KNOB_SIZE = 25;
const KNOB_INSET = 2;
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;

export const Toggle: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const progress = useSharedValue(value ? 1 : 0);
  const offColor = theme.colors.divider;
  const onColor = theme.colors.blue;

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {duration: durations.fast});
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [offColor, onColor],
    ),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{translateX: KNOB_INSET + KNOB_TRAVEL * progress.value}],
  }));

  return (
    <PressableOpacity
      testID={testID}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{checked: value, disabled}}
      accessibilityLabel={accessibilityLabel}
      style={[styles.hitArea, disabled && styles.disabled, style]}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </PressableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    hitArea: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: {
      opacity: 0.5,
    },
    track: {
      width: TRACK_WIDTH,
      height: 29,
      borderRadius: theme.borderRadius.pill,
      justifyContent: 'center',
      // The off-track measures 1.20:1 against the surface behind it and the
      // white knob 1.33:1 against the track, so the control's extent was not
      // identifiable at the 3:1 WCAG 1.4.11 asks. Darkening the fill enough to
      // clear 3:1 would need a mid-brown - nothing like a switch - and a
      // hairlineWidth border renders at 1.24:1, i.e. does nothing. A full pixel
      // of controlBorder is what actually draws the boundary.
      borderWidth: 1,
      borderColor: theme.colors.controlBorder,
    },
    knob: {
      width: KNOB_SIZE,
      height: KNOB_SIZE,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.white,
      ...theme.shadows.card,
    },
  });
