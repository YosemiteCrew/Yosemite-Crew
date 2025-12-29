import React, {useMemo} from 'react';
import {SafeAreaView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';

interface ScreenLayoutProps {
  children: React.ReactNode;
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightIcon?: any;
  onRightPress?: () => void;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

/**
 * Standard screen layout with liquid glass header
 * Eliminates duplication across screens with the same header pattern
 */
export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  children,
  title,
  showBackButton = true,
  onBack,
  rightIcon,
  onRightPress,
  edges = [],
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <View
        style={styles.topSection}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <View style={styles.topGlassShadowWrapper}>
          <LiquidGlassCard
            glassEffect="clear"
            interactive={false}
            shadow="none"
            style={[styles.topGlassCard, {paddingTop: insets.top}]}
            fallbackStyle={styles.topGlassFallback}>
            <Header
              title={title}
              showBackButton={showBackButton}
              onBack={onBack}
              rightIcon={rightIcon}
              onRightPress={onRightPress}
              glass={false}
            />
          </LiquidGlassCard>
        </View>
      </View>

      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            topGlassHeight,
          });
        }
        return child;
      })}
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    ...createLiquidGlassHeaderStyles(theme),
  });
