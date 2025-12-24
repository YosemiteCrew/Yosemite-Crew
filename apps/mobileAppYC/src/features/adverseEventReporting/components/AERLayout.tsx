import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/shared/components/common/Header/Header';
import { LiquidGlassCard } from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import { useTheme } from '@/hooks';
import PrimaryActionButton from '@/shared/components/common/PrimaryActionButton/PrimaryActionButton';
import { createLiquidGlassHeaderStyles } from '@/shared/utils/screenStyles';

export interface AERLayoutProps {
  children: React.ReactNode;
  stepLabel?: string; // e.g., "Step 1 of 5" or any top small label
  bottomButton?: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    textStyleOverride?: any;
  };
  headerTitle?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export const AERLayout: React.FC<AERLayoutProps> = ({
  children,
  stepLabel,
  bottomButton,
  headerTitle = 'Adverse event reporting',
  showBackButton = true,
  onBack,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View
        style={[styles.topSection, {paddingTop: insets.top}]}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive={false}
          style={styles.topGlassCard}
          fallbackStyle={styles.topGlassFallback}>
          <Header
            title={headerTitle}
            showBackButton={showBackButton}
            onBack={onBack}
            glass={false}
          />
        </LiquidGlassCard>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          topGlassHeight
            ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['3']}
            : null,
        ]}
        showsVerticalScrollIndicator={false}>
        {stepLabel ? <Text style={styles.stepLabel}>{stepLabel}</Text> : null}
        {children}
        {bottomButton ? (
          <View style={styles.buttonContainer}>
            <PrimaryActionButton
              title={bottomButton.title}
              onPress={bottomButton.onPress}
              disabled={bottomButton.disabled}
              textStyle={bottomButton.textStyleOverride}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    ...createLiquidGlassHeaderStyles(theme),
    scrollContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['24'],
    },
    stepLabel: {
      ...theme.typography.subtitleBold12,
      lineHeight: 12,
      color: theme.colors.placeholder,
      marginBottom: theme.spacing['4'],
      textAlign: 'center',
    },
    buttonContainer: {
      marginTop: theme.spacing['4'],
    },
  });

export default AERLayout;
