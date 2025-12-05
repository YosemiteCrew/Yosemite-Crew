import React from 'react';
import {Alert, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Input} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {useTheme} from '@/hooks';
import {useAuth} from '@/features/auth/context/AuthContext';
import {withdrawalService} from '@/features/legal/services/withdrawalService';
import {getCurrentFcmToken} from '@/shared/services/firebaseNotifications';
import {unregisterDeviceToken} from '@/shared/services/deviceTokenRegistry';
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
import type {AuthStackParamList} from '@/navigation/AuthNavigator';

type LegalStackParamList = HomeStackParamList & AuthStackParamList;
type TermsScreenProps = NativeStackScreenProps<LegalStackParamList, 'TermsAndConditions'>;
type WithdrawalErrors = Partial<
  Record<'fullName' | 'email' | 'address' | 'signature' | 'consent' | 'general', string>
>;

const WITHDRAWAL_MESSAGE =
  'I/we hereby withdraw the contract concluded with you.';

export const TermsAndConditionsScreen: React.FC<TermsScreenProps> = (props) => {
  const {theme} = useTheme();
  const {user, logout} = useAuth();
  const styles = React.useMemo(() => createLegalStyles(theme), [theme]);

  const [withdrawalForm, setWithdrawalForm] = React.useState({
    fullName: '',
    email: '',
    address: '',
    signature: '',
    consent: false,
  });
  const [formErrors, setFormErrors] = React.useState<WithdrawalErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setWithdrawalForm(prev => {
        const fullNameFromUser = [user.firstName, user.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();

        return {
          ...prev,
          email: prev.email || user.email || '',
          fullName: prev.fullName || fullNameFromUser,
        };
      });
    }
  }, [user]);

  const clearFieldError = React.useCallback((field: keyof WithdrawalErrors) => {
    setFormErrors(prev => {
      if (!prev[field] && !prev.general) {
        return prev;
      }

      const next = {...prev};
      delete next[field];
      delete next.general;
      return next;
    });
  }, []);

  const validateEmail = React.useCallback(
    (trimmedEmail: string): string | undefined => {
      if (!trimmedEmail) {
        return 'Email is required.';
      }

      // Limit email length to prevent ReDoS attacks
      if (trimmedEmail.length > 320) {
        return 'Email is too long.';
      }

      const atIndex = trimmedEmail.indexOf('@');
      const lastDotIndex = trimmedEmail.lastIndexOf('.');

      // Simple validation: contains @ and . in correct positions, no whitespace
      const isValidFormat =
        atIndex > 0 &&
        lastDotIndex > atIndex + 1 &&
        lastDotIndex < trimmedEmail.length - 1 &&
        !trimmedEmail.includes(' ');

      if (!isValidFormat) {
        return 'Enter a valid email address.';
      }

      if (user?.email?.trim()) {
        const normalizedInput = trimmedEmail.toLowerCase();
        const normalizedAuthEmail = user.email.trim().toLowerCase();
        if (normalizedInput !== normalizedAuthEmail) {
          return `Email must match your account (${user.email}).`;
        }
      }

      return undefined;
    },
    [user?.email]
  );

  const validateForm = React.useCallback((): WithdrawalErrors => {
    const errors: WithdrawalErrors = {};
    const trimmedName = withdrawalForm.fullName.trim();
    const trimmedEmail = withdrawalForm.email.trim();
    const trimmedAddress = withdrawalForm.address.trim();
    const trimmedSignature = withdrawalForm.signature.trim();

    if (!trimmedName) {
      errors.fullName = 'Full name is required.';
    }

    const emailError = validateEmail(trimmedEmail);
    if (emailError) {
      errors.email = emailError;
    }

    if (!trimmedAddress) {
      errors.address = 'Address is required.';
    }

    if (!trimmedSignature) {
      errors.signature = 'Signature is required.';
    }

    if (!withdrawalForm.consent) {
      errors.consent = 'Please confirm the withdrawal statement.';
    }

    return errors;
  }, [validateEmail, withdrawalForm]);

  const handleLogoutAfterSubmission = React.useCallback(() => {
    logout().catch(logoutError => {
      console.warn('[Withdrawal] Logout after submission failed', logoutError);
    });
  }, [logout]);

  const handleSubmit = React.useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors(prev => ({...prev, general: undefined}));

    try {
      await withdrawalService.submitWithdrawal({
        fullName: withdrawalForm.fullName.trim(),
        email: withdrawalForm.email.trim(),
        address: withdrawalForm.address.trim(),
        signatureText: withdrawalForm.signature.trim(),
        message: WITHDRAWAL_MESSAGE,
        checkboxConfirmed: withdrawalForm.consent,
      });

      try {
        const token = await getCurrentFcmToken();
        if (token) {
          await unregisterDeviceToken({userId: user?.id, token});
        }
      } catch (tokenError) {
        console.warn('[Withdrawal] Failed to unregister device token', tokenError);
      }

      Alert.alert(
        'Withdrawal submitted',
        'We have received your withdrawal request. You will be signed out now.',
        [
          {
            text: 'OK',
            onPress: handleLogoutAfterSubmission,
          },
        ],
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to submit withdrawal right now.';
      setFormErrors(prev => ({...prev, general: message}));
      Alert.alert('Unable to submit', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [handleLogoutAfterSubmission, isSubmitting, user?.id, validateForm, withdrawalForm]);

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
            setWithdrawalForm(prev => {
              clearFieldError('fullName');
              return {...prev, fullName: value};
            })
          }
          error={formErrors.fullName}
        />
        <Input
          label="Email Address"
          keyboardType="email-address"
          value={withdrawalForm.email}
          onChangeText={value =>
            setWithdrawalForm(prev => {
              clearFieldError('email');
              return {...prev, email: value};
            })
          }
          error={formErrors.email}
        />
        <Input
          label="User Address"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          inputStyle={styles.textArea}
          value={withdrawalForm.address}
          onChangeText={value =>
            setWithdrawalForm(prev => {
              clearFieldError('address');
              return {...prev, address: value};
            })
          }
          error={formErrors.address}
        />
        <Input
          label="Signature (Type Full Name)"
          value={withdrawalForm.signature}
          onChangeText={value =>
            setWithdrawalForm(prev => {
              clearFieldError('signature');
              return {...prev, signature: value};
            })
          }
          error={formErrors.signature}
        />
      </View>

      <Checkbox
        value={withdrawalForm.consent}
        onValueChange={value =>
          setWithdrawalForm(prev => {
            clearFieldError('consent');
            return {...prev, consent: value};
          })
        }
        label="I/We hereby withdraw the contract concluded by me/us (*) for the purchase of the following goods (*)/the provision of the following service (*)"
        labelStyle={styles.checkboxLabel}
      />

      {formErrors.consent && (
        <Text style={styles.formErrorText}>{formErrors.consent}</Text>
      )}
      {formErrors.general && (
        <Text style={styles.formErrorText}>{formErrors.general}</Text>
      )}

      <LiquidGlassButton
        title="Submit"
        onPress={handleSubmit}
        glassEffect="regular"
        interactive
        tintColor={theme.colors.secondary}
        borderColor={theme.colors.secondary}
        style={styles.glassButtonDark}
        textStyle={styles.glassButtonDarkText}
        loading={isSubmitting}
        disabled={isSubmitting}
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
