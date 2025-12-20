import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeArea } from '@/shared/components/common';
import { Header } from '@/shared/components/common/Header/Header';
import { useTheme } from '@/hooks';
import PrimaryActionButton from '@/shared/components/common/PrimaryActionButton/PrimaryActionButton';

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

  return (
    <SafeArea>
      <Header title={headerTitle} showBackButton={showBackButton} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['4'],
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
