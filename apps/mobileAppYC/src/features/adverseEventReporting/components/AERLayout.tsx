import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import PrimaryActionButton from '@/shared/components/common/PrimaryActionButton/PrimaryActionButton';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

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
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title={headerTitle}
          showBackButton={showBackButton}
          onBack={onBack}
          glass={false}
        />
      }
      contentPadding={theme.spacing['3']}
      useSafeAreaView
      containerStyle={styles.safeArea}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentPaddingStyle]}
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
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
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
