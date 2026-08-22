import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import PrimaryActionButton from '@/shared/components/common/PrimaryActionButton/PrimaryActionButton';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

export interface AERLayoutProps {
  children: React.ReactNode;
  stepLabel?: string; // e.g., "Step 1 of 5" or any top small label
  // Warm-bone AER step progress. When both are provided, the layout renders a
  // segmented progress bar + "N/M" counter instead of the plain text label.
  currentStep?: number;
  totalSteps?: number;
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
  currentStep,
  totalSteps,
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
      {contentPaddingStyle => {
        let topBlock: React.ReactNode = null;
        if (currentStep != null && totalSteps) {
          const segments = Array.from({length: totalSteps}, (_, index) => ({
            key: `aer-progress-segment-${index}`,
            active: index < currentStep,
          }));
          topBlock = (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                {segments.map(segment => (
                  <View
                    key={segment.key}
                    style={[
                      styles.progressSegment,
                      segment.active
                        ? styles.progressSegmentActive
                        : styles.progressSegmentInactive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.progressCounter}>
                {`${currentStep}/${totalSteps}`}
              </Text>
            </View>
          );
        } else if (stepLabel) {
          topBlock = <Text style={styles.stepLabel}>{stepLabel}</Text>;
        }
        return (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentPaddingStyle]}
            showsVerticalScrollIndicator={false}>
            {topBlock}
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
        );
      }}
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
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['1'],
      marginBottom: theme.spacing['6'],
    },
    progressTrack: {
      flex: 1,
      flexDirection: 'row',
      gap: theme.spacing['1.25'],
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: theme.borderRadius.full,
    },
    progressSegmentActive: {
      backgroundColor: theme.colors.blue,
    },
    progressSegmentInactive: {
      backgroundColor: theme.colors.inset,
    },
    progressCounter: {
      ...theme.typography.subtitleBold12,
      color: theme.colors.inkMuted,
    },
    buttonContainer: {
      marginTop: theme.spacing['4'],
    },
  });

export default AERLayout;
