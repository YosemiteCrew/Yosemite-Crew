/**
 * ScreenLayout - Reusable screen layout component
 * Provides consistent screen structure with optional liquid glass header
 * Eliminates duplication across all screens
 */
import React, {useState, ReactNode} from 'react';
import {View, ScrollView, StyleSheet, ViewStyle, ScrollViewProps} from 'react-native';
import {SafeAreaView, useSafeAreaInsets, Edge} from 'react-native-safe-area-context';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';
import {useTheme} from '@/hooks';

export interface ScreenLayoutProps {
  /** Header content to display in liquid glass card */
  header?: ReactNode;

  /** Main content to display */
  children: ReactNode | ((contentPaddingStyle: ViewStyle) => ReactNode);

  /** Whether to show liquid glass header. Default: true when header is provided */
  showLiquidHeader?: boolean;

  /** Background color for safe area. Default: theme.colors.background */
  backgroundColor?: string;

  /** Padding for scroll content. Default: theme.spacing['6'] */
  contentPadding?: number;

  /** Gap between header and content. Default: theme.spacing['1'] */
  cardGap?: number;

  /** Additional scroll view props */
  scrollViewProps?: Partial<ScrollViewProps>;

  /** Additional style for content container */
  contentContainerStyle?: ViewStyle;

  /** Safe area edges to apply. Default: [] */
  safeAreaEdges?: Edge[];

  /** Additional bottom padding. Default: theme.spacing['6'] */
  bottomPadding?: number;
}

/**
 * ScreenLayout component for consistent screen structure
 *
 * Usage with liquid glass header:
 * ```tsx
 * <ScreenLayout header={<Header title="My Screen" />}>
 *   <View>Content here</View>
 * </ScreenLayout>
 * ```
 *
 * Usage with render prop for content padding:
 * ```tsx
 * <ScreenLayout header={<Header />}>
 *   {contentPaddingStyle => (
 *     <FlatList contentContainerStyle={contentPaddingStyle} />
 *   )}
 * </ScreenLayout>
 * ```
 */
export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  header,
  children,
  showLiquidHeader = true,
  backgroundColor,
  contentPadding,
  cardGap,
  scrollViewProps = {},
  contentContainerStyle,
  safeAreaEdges = [],
  bottomPadding,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = useState(0);

  const hasLiquidHeader = showLiquidHeader && header;
  const bgColor = backgroundColor ?? theme.colors.background;

  const headerStyles = React.useMemo(
    () => createLiquidGlassHeaderStyles(theme, {cardGap}),
    [theme, cardGap],
  );

  const contentPaddingValue = contentPadding ?? theme.spacing['6'];
  const bottomPaddingValue = bottomPadding ?? theme.spacing['6'];

  const contentPaddingStyle: ViewStyle = {
    paddingHorizontal: contentPaddingValue,
    paddingBottom: bottomPaddingValue,
  };

  const dynamicContentStyle: ViewStyle = hasLiquidHeader
    ? {paddingTop: topGlassHeight + (cardGap ?? theme.spacing['1'])}
    : {};

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: bgColor}]} edges={safeAreaEdges}>
      {hasLiquidHeader && (
        <View
          style={headerStyles.topSection}
          onLayout={event => {
            const height = event.nativeEvent.layout.height;
            if (height !== topGlassHeight) {
              setTopGlassHeight(height);
            }
          }}>
          <View style={headerStyles.topGlassShadowWrapper}>
            <LiquidGlassCard
              glassEffect="clear"
              interactive={false}
              shadow="none"
              style={[headerStyles.topGlassCard, {paddingTop: insets.top}]}
              fallbackStyle={headerStyles.topGlassFallback}>
              {header}
            </LiquidGlassCard>
          </View>
        </View>
      )}

      {typeof children === 'function' ? (
        children({...contentPaddingStyle, ...dynamicContentStyle, ...contentContainerStyle})
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            contentPaddingStyle,
            dynamicContentStyle,
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          {...scrollViewProps}>
          {children}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});
