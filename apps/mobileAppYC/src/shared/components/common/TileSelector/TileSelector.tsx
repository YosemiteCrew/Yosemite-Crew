// src/components/common/TileSelector/TileSelector.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {useTheme} from '@/hooks';

export interface TileSelectorOption {
  value: string;
  label: string;
}

interface TileSelectorProps {
  options: TileSelectorOption[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  style?: ViewStyle;
  tileStyle?: ViewStyle;
  selectedTileStyle?: ViewStyle;
  labelStyle?: TextStyle;
  selectedLabelStyle?: TextStyle;
}

export const TileSelector: React.FC<TileSelectorProps> = ({
  options,
  selectedValue,
  onSelect,
  style,
  tileStyle,
  selectedTileStyle,
  labelStyle,
  selectedLabelStyle,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, style]}>
      {options.map(option => {
        const isSelected = selectedValue === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.tile,
              tileStyle,
              isSelected && styles.tileSelected,
              isSelected && selectedTileStyle,
            ]}
            onPress={() => onSelect(option.value)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.label,
                labelStyle,
                isSelected && styles.labelSelected,
                isSelected && selectedLabelStyle,
              ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['3'],
    },
    tile: {
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['3'],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    tileSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySurface,
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '500',
    },
    labelSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });
