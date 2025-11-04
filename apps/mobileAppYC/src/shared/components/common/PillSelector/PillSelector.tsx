import React from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Text,
  View,
} from 'react-native';
import {useTheme} from '@/hooks';

export interface PillOption {
  id: string;
  label: string;
  badgeCount?: number;
}

interface PillSelectorProps {
  options: PillOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  containerStyle?: ViewStyle;
  contentStyle?: ViewStyle;
  pillSpacing?: number;
  allowScroll?: boolean;
}

export const PillSelector: React.FC<PillSelectorProps> = ({
  options,
  selectedId,
  onSelect,
  containerStyle,
  contentStyle,
  pillSpacing,
  allowScroll = true,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme, pillSpacing), [theme, pillSpacing]);

  const renderOption = React.useCallback(
    (option: PillOption) => {
      const isSelected = selectedId === option.id;
      return (
        <TouchableOpacity
          key={option.id}
          style={[styles.pill, isSelected && styles.pillActive]}
          onPress={() => onSelect(option.id)}
          activeOpacity={0.85}>
          <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
            {option.label}
          </Text>
          {typeof option.badgeCount === 'number' && option.badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{option.badgeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [
      onSelect,
      selectedId,
      styles.badge,
      styles.badgeText,
      styles.pill,
      styles.pillActive,
      styles.pillText,
      styles.pillTextActive,
    ],
  );

  if (allowScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        style={[styles.container, containerStyle]}>
        {options.map(renderOption)}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.staticContainer, containerStyle]}>
      {options.map(renderOption)}
    </View>
  );
};

const createStyles = (theme: any, pillSpacing?: number) =>
  StyleSheet.create({
    container: {
      flexGrow: 0,
    },
    scrollContent: {
      gap: pillSpacing ?? theme.spacing['2'],
      paddingRight: theme.spacing['2'],
    },
    staticContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: pillSpacing ?? theme.spacing['2'],
      rowGap: pillSpacing ?? theme.spacing['2'],
    },
    pill: {
      borderWidth: 1,
      borderColor: theme.colors.text,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['1.25'],
      backgroundColor: theme.colors.white,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['1'],
      minHeight: 40,
    },
    pillActive: {
  backgroundColor: theme.colors.lightBlueBackground,
  borderColor: theme.colors.primary,
    },
    pillText: {
      ...theme.typography.pillSubtitleBold15,
  color: theme.colors.text,
      textAlign: 'center',
    },
    pillTextActive: {
  color: theme.colors.primary,
    },
    badge: {
      minWidth: 20,
      paddingHorizontal: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      ...theme.typography.captionBold,
      color: theme.colors.white,
    },
  });

export default PillSelector;
