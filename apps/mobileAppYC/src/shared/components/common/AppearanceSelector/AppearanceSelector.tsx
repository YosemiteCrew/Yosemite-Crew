// src/shared/components/common/AppearanceSelector/AppearanceSelector.tsx
//
// Light / Dark / System theme switch. Defaults follow the persisted preference
// (system by default); selecting a mode persists it and flips the warm-bone
// light or espresso theme app-wide.

import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {SegmentedControl} from '@/shared/components/common/SegmentedControl/SegmentedControl';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

type ThemeMode = 'light' | 'dark' | 'system';

const OPTIONS: {label: string; value: ThemeMode}[] = [
  {label: 'Light', value: 'light'},
  {label: 'Dark', value: 'dark'},
  {label: 'System', value: 'system'},
];

export interface AppearanceSelectorProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AppearanceSelector: React.FC<AppearanceSelectorProps> = ({
  label = 'Appearance',
  style,
  testID,
}) => {
  const {theme, themeMode, setTheme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <SegmentedControl
        options={OPTIONS}
        value={themeMode}
        onChange={value => setTheme(value as ThemeMode)}
        testID={testID ? `${testID}-control` : 'appearance-control'}
      />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      padding: theme.spacing['4'],
      gap: theme.spacing['3'],
      ...theme.shadows.card,
    },
    label: {
      ...theme.typography.sectionHeading,
      color: theme.colors.ink,
    },
  });
