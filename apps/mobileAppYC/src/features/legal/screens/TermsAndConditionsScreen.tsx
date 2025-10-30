import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Header, Input} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {useTheme} from '@/hooks';
import {LegalContentRenderer} from '../components/LegalContentRenderer';
import {TERMS_SECTIONS} from '../data/termsData';

if (__DEV__) {
  try {
    console.debug('TermsAndConditionsScreen: TERMS_SECTIONS typeof', typeof TERMS_SECTIONS, 'isArray', Array.isArray(TERMS_SECTIONS), 'len', Array.isArray(TERMS_SECTIONS) ? TERMS_SECTIONS.length : 'N/A');
  } catch (err) {
    // consume
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _err = err;
  }
}
import type {HomeStackParamList} from '@/navigation/types';

type TermsScreenProps = NativeStackScreenProps<HomeStackParamList, 'TermsAndConditions'>;

export const TermsAndConditionsScreen: React.FC<TermsScreenProps> = ({
  navigation,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [withdrawalForm, setWithdrawalForm] = React.useState({
    fullName: '',
    email: '',
    address: '',
    signature: '',
    consent: false,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Terms & Conditions"
        showBackButton
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <LegalContentRenderer sections={TERMS_SECTIONS} />

        <LiquidGlassCard
          glassEffect="regular"
          interactive
          style={styles.withdrawalCard}
          fallbackStyle={styles.withdrawalCardFallback}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle} numberOfLines={1} ellipsizeMode="tail">
              Withdrawal Form
            </Text>
            <Text style={styles.formSubtitle} numberOfLines={2} ellipsizeMode="tail">
              Fill the form for Withdrawal
            </Text>
          </View>

          <View style={styles.formFields}>
            <Input
              label="User Full Name"
              value={withdrawalForm.fullName}
              onChangeText={value =>
                setWithdrawalForm(prev => ({...prev, fullName: value}))
              }
            />
            <Input
              label="Email Address"
              keyboardType="email-address"
              value={withdrawalForm.email}
              onChangeText={value =>
                setWithdrawalForm(prev => ({...prev, email: value}))
              }
            />
            <Input
              label="User Address"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              inputStyle={styles.textArea}
              value={withdrawalForm.address}
              onChangeText={value =>
                setWithdrawalForm(prev => ({...prev, address: value}))
              }
            />
            <Input
              label="Signature (Type Full Name)"
              value={withdrawalForm.signature}
              onChangeText={value =>
                setWithdrawalForm(prev => ({...prev, signature: value}))
              }
            />
          </View>

          <Checkbox
            value={withdrawalForm.consent}
            onValueChange={value =>
              setWithdrawalForm(prev => ({...prev, consent: value}))
            }
            label="I/We hereby withdraw the contract concluded by me/us (*) for the purchase of the following goods (*)/the provision of the following service (*)"
            labelStyle={styles.checkboxLabel}
          />

          <LiquidGlassButton
            title="Submit"
            onPress={() => {}}
            glassEffect="regular"
            interactive
            tintColor={theme.colors.secondary}
            borderColor={theme.colors.secondary}
            style={styles.glassButtonDark}
            textStyle={styles.glassButtonDarkText}
          />

          <Text style={styles.formFooter}>
            <Text style={styles.formFooterInline}>Form will be submitted to </Text>
            <Text style={styles.formFooterInlineBold}>DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127 Mainz, Germany, email address: </Text>
            <Text style={styles.formFooterEmail} accessibilityRole="link">security@yosemitecrew.com</Text>
          </Text>
        </LiquidGlassCard>
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
      paddingTop: theme.spacing['3'],
      paddingBottom: theme.spacing['10'],
      gap: theme.spacing['4'],
    },
    withdrawalCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    withdrawalCard: {
      gap: theme.spacing['4'],
    },
    formHeader: {
      gap: theme.spacing['1'],
    },
    formTitle: {
      // Subtitle Bold 14
      fontFamily: theme.typography.subtitleBold14?.fontFamily || theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleBold14?.fontSize || 14,
      lineHeight: theme.typography.subtitleBold14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleBold14?.fontWeight || '700',
      color: theme.colors.text,
      overflow: 'hidden',
    },
    formSubtitle: {
      // Subtitle Regular 14 with 2-line clamp equivalent (handled via numberOfLines in JSX)
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
      overflow: 'hidden',
    },
    checkboxLabel: {
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
    },
    formFields: {
      gap: theme.spacing['3'],
    },
    textArea: {
      minHeight: 96,
    },
    formFooter: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    formFooterInline: {
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
      textAlign: 'center',
    },
    formFooterInlineBold: {
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    formFooterEmail: {
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      color: theme.colors.text,
      textDecorationLine: 'underline',
      textAlign: 'center',
    },
    glassButtonDark: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      minHeight: 56,
    },
    glassButtonDarkText: {
      fontFamily: theme.typography.businessTitle16.fontFamily,
      fontSize: 16,
      fontWeight: theme.typography.businessTitle16.fontWeight,
      letterSpacing: -0.16,
      lineHeight: 16,
      color: theme.colors.white,
      textAlign: 'center',
    },
  });

export default TermsAndConditionsScreen;
