import React, {useMemo} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {useTheme} from '@/hooks';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

type Extractor<T> = (item: Readonly<T>) => string;
type Mapper<T> = (item: Readonly<T>) => string | undefined | null;
type Initials<T> = (item: Readonly<T>) => string;

export interface SearchDropdownOverlayProps<T = unknown> {
  readonly visible: boolean;
  readonly top?: number;
  readonly maxHeight?: number;
  readonly containerStyle?: ViewStyle;
  readonly scrollEnabledThreshold?: number;
  readonly useGlassCard?: boolean;
  readonly glassEffect?: 'clear' | 'regular';
  readonly items: ReadonlyArray<T>;
  readonly keyExtractor: Extractor<T>;
  readonly onPress: (item: T) => void;
  readonly title: Mapper<T>;
  readonly subtitle?: Mapper<T>;
  readonly initials?: Initials<T>;
}

export function SearchDropdownOverlay<T = unknown>({
  visible,
  top = 70,
  maxHeight,
  containerStyle,
  scrollEnabledThreshold = 5,
  useGlassCard = false,
  glassEffect = 'clear',
  items,
  keyExtractor,
  onPress,
  title,
  subtitle,
  initials,
}: Readonly<SearchDropdownOverlayProps<T>>) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme, top, maxHeight), [maxHeight, theme, top]);

  if (!visible || items.length === 0) return null;

  const scrollViewStyle = useGlassCard
    ? styles.glassScrollContainer
    : styles.dropdownContainer;

  const scrollView = (
    <ScrollView
      style={scrollViewStyle}
      scrollEnabled={items.length > scrollEnabledThreshold}
      showsVerticalScrollIndicator
      nestedScrollEnabled>
      {items.map(item => (
        <TouchableOpacity
          key={keyExtractor(item)}
          style={styles.item}
          onPress={() => onPress(item)}>
          <View style={styles.itemAvatar}>
            <Text style={styles.itemAvatarText}>
              {(initials?.(item) || title(item) || ' ')?.charAt(0)?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>{title(item)}</Text>
            {subtitle ? (
              <Text style={styles.itemSubtitle}>{subtitle(item)}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View style={[styles.absoluteContainer, containerStyle]}>
      {useGlassCard ? (
        <LiquidGlassCard
          glassEffect={glassEffect}
          interactive
          padding="0"
          shadow="md"
          style={styles.glassCard}
          fallbackStyle={styles.glassCardFallback}>
          {scrollView}
        </LiquidGlassCard>
      ) : (
        scrollView
      )}
    </View>
  );
}

const createStyles = (theme: any, top: number, maxHeight?: number) => {
  const resolvedMaxHeight = maxHeight ?? theme.spacing['80'];
  const isAndroid = Platform.OS === 'android';

  const dropdownBase = {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: resolvedMaxHeight,
    ...(isAndroid ? theme.shadows.sm : theme.shadows.md),
    shadowColor: theme.colors.neutralShadow,
  };

  const glassCardBase = {
    padding: 0,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden' as const,
    maxHeight: resolvedMaxHeight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: 'transparent',
  };

  return StyleSheet.create({
    absoluteContainer: {
      position: 'absolute',
      top,
      left: theme.spacing['4'],
      right: theme.spacing['4'],
      maxHeight: resolvedMaxHeight,
      zIndex: 100,
    },
    dropdownContainer: dropdownBase,
    glassScrollContainer: {
      backgroundColor: 'transparent',
    },
    glassCard: glassCardBase,
    glassCardFallback: {
      ...glassCardBase,
      backgroundColor: theme.colors.white,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['3'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemAvatar: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.lightBlueBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemAvatarText: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
    },
    itemInfo: {
      flex: 1,
    },
    itemTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['1'],
    },
    itemSubtitle: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.textSecondary,
    },
  });
};

export default SearchDropdownOverlay;
