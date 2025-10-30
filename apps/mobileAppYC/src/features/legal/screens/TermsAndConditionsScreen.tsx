import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Header, Input} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LegalContentRenderer} from '../components/LegalContentRenderer';
import {TERMS_SECTIONS} from '../data/termsData';
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
        rightIcon={Images.accountShareIcon}
        onRightPress={() => {}}
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
            <Text style={styles.formTitle}>Withdrawal Form</Text>
            <Text style={styles.formSubtitle}>
              Fill the form for Withdrawal
            </Text>
          </View>

          <View style={styles.formFields}>
            <Input
              label="User Full Name"
              placeholder="Full name"
              value={withdrawalForm.fullName}
              onChangeText={value =>
                setWithdrawalForm(prev => ({...prev, fullName: value}))
              }
            />
            <Input
              label="Email Address"
              placeholder="Email"
              keyboardType="email-address"
              value={withdrawalForm.email}
              onChangeText={value =>
                setWithdrawalForm(prev => ({...prev, email: value}))
              }
            />
            <Input
              label="User Address"
              placeholder="Address"
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
              label="Signature"
              placeholder="Type your name"
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
            Form will be submitted to DuneXploration UG (haftungsbeschränkt), Am
            Finther Weg 7, 55127 Mainz, Germany, email address:
            security@yosemitecrew.com
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
      ...theme.typography.h5,
      color: theme.colors.secondary,
    },
    formSubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
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
