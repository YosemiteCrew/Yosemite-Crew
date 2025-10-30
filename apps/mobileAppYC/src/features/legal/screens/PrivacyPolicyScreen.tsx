import React from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Header} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LegalContentRenderer} from '../components/LegalContentRenderer';
import {PRIVACY_POLICY_SECTIONS} from '../data/privacyPolicyData';
import type {HomeStackParamList} from '@/navigation/types';

type PrivacyScreenProps = NativeStackScreenProps<HomeStackParamList, 'PrivacyPolicy'>;

export const PrivacyPolicyScreen: React.FC<PrivacyScreenProps> = ({
  navigation,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Privacy Policy"
        showBackButton
        onBack={() => navigation.goBack()}
        rightIcon={Images.accountInfoIcon}
        onRightPress={() => {}}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <LiquidGlassCard
          glassEffect="regular"
          interactive
          style={styles.introCard}
          fallbackStyle={styles.introCardFallback}>
          <Text style={styles.introTitle}>How to edit this page</Text>
          <Text style={styles.introBody}>
            Update the content by modifying the data objects in
            {' '}
            <Text style={styles.introCode}>privacyPolicyData.ts</Text>. The renderer supports bold headings,
            underlined phrases, numbered lists with bold markers, and single bold words at the beginning of paragraphs.
          </Text>
        </LiquidGlassCard>

        <LegalContentRenderer sections={PRIVACY_POLICY_SECTIONS} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['10'],
      gap: theme.spacing['4'],
    },
    introCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    introCard: {
      gap: theme.spacing['2'],
    },
    introTitle: {
      ...theme.typography.h6,
      color: theme.colors.secondary,
    },
    introBody: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    introCode: {
      ...theme.typography.bodySmall,
      fontFamily: theme.typography.paragraphBold.fontFamily,
      fontWeight: theme.typography.paragraphBold.fontWeight,
      color: theme.colors.secondary,
    },
  });

export default PrivacyPolicyScreen;
