// src/shared/components/common/SegmentedControl/SegmentedControl.tsx
//
// Warm-bone segmented control. Inset track with a raised active segment
// (screen fill + card shadow), used for Upcoming/Past style switches.

import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

export interface SegmentOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  style,
  testID,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[styles.track, style]}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <PressableOpacity
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentActive]}>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                selected ? styles.labelActive : styles.labelInactive,
              ]}>
              {option.label}
            </Text>
          </PressableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: theme.colors.inset,
      // Rounded rectangle, not a full stadium (matches the design switch).
      borderRadius: 14,
      padding: theme.spacing['1'],
    },
    segment: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      paddingVertical: theme.spacing['2'],
    },
    segmentActive: {
      backgroundColor: theme.colors.screen,
      // screen and inset are near-identical in the espresso theme (1.01:1), so
      // the card shadow was doing all the work, and a dark shadow on a dark
      // ground shows nothing. This border carries the selected state in both
      // themes at the 3:1 WCAG 1.4.11 bar.
      borderWidth: 1,
      borderColor: theme.colors.segmentSelectedBorder,
      ...theme.shadows.card,
    },
    label: {
      ...theme.typography.labelSmallBold,
      fontSize: 13.5,
    },
    labelActive: {
      color: theme.colors.inkBody,
    },
    labelInactive: {
      color: theme.colors.inkMuted,
    },
  });
