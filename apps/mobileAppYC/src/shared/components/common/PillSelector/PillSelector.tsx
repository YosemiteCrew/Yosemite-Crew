import React from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Text,
  View,
  FlatList,
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
  autoScroll?: boolean;
}

export const PillSelector: React.FC<PillSelectorProps> = ({
  options,
  selectedId,
  onSelect,
  containerStyle,
  contentStyle,
  pillSpacing,
  allowScroll = true,
  autoScroll = false,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme, pillSpacing), [theme, pillSpacing]);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const flatListRef = React.useRef<FlatList>(null);

  const selectedIndex = React.useMemo(
    () => options.findIndex(option => option.id === selectedId),
    [options, selectedId],
  );

  const scrollToSelected = React.useCallback(() => {
    if (!autoScroll || selectedIndex === -1) {
      return;
    }

    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: selectedIndex,
          viewPosition: 0.5,
          animated: true,
        });
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: selectedIndex,
            viewPosition: 0.5,
            animated: true,
          });
        }, 300);
      }
    }, 100);
  }, [autoScroll, selectedIndex]);

  React.useEffect(() => {
    scrollToSelected();
  }, [scrollToSelected]);

  const getItemLayout = React.useCallback(
    (_data: any, index: number) => {
      const averageItemWidth = 120;
      const gap = pillSpacing ?? theme.spacing['2'];
      return {
        length: averageItemWidth,
        offset: index * (averageItemWidth + gap),
        index,
      };
    },
    [pillSpacing, theme.spacing],
  );

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

  const renderFlatListItem = React.useCallback(
    ({item}: {item: PillOption}) => renderOption(item),
    [renderOption],
  );

  if (allowScroll) {
    if (autoScroll) {
      return (
        <FlatList
          ref={flatListRef}
          horizontal
          data={options}
          renderItem={renderFlatListItem}
          keyExtractor={item => item.id}
          initialScrollIndex={selectedIndex === -1 ? undefined : selectedIndex}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          style={[styles.container, containerStyle]}
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={error => {
            console.warn('ScrollToIndex failed:', error.index);
          }}
        />
      );
    }

    return (
      <ScrollView
        ref={scrollViewRef}
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
