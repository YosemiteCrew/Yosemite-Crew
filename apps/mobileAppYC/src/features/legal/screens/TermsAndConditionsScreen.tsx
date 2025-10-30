import React from 'react';
import {Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Input} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {useTheme} from '@/hooks';
import {LegalScreen} from '../components/LegalScreen';
import {TERMS_SECTIONS} from '../data/termsData';
import {createLegalStyles} from '../styles/legalStyles';

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

export const TermsAndConditionsScreen: React.FC<TermsScreenProps> = (props) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createLegalStyles(theme), [theme]);

  const [withdrawalForm, setWithdrawalForm] = React.useState({
    fullName: '',
    email: '',
    address: '',
    signature: '',
    consent: false,
  });

  const extraContent = (
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
  );

  return (
    <LegalScreen
      {...props}
      title="Terms & Conditions"
      sections={TERMS_SECTIONS}
      extraContent={extraContent}
    />
  );
};

export default TermsAndConditionsScreen;
