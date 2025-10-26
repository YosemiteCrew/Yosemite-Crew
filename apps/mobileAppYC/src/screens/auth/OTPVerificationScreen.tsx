import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeArea, OTPInput, Header} from '../../components/common';
import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../../navigation/AuthNavigator';
import {
  completePasswordlessSignIn,
  formatAuthError,
  requestPasswordlessEmailCode,
} from '@/services/auth/passwordlessAuth';
import {useAuth, type User} from '../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_PROFILE_STORAGE_KEY,
  PENDING_PROFILE_UPDATED_EVENT,
} from '@/config/variables';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 60;

type OTPVerificationScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'OTPVerification'
>;

export const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const {theme} = useTheme();
  const {login, logout} = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {email, isNewUser} = route.params;

  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!canResend && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }

    return () => undefined;
  }, [countdown, canResend]);

  const handleOtpFilled = (value: string) => {
    setOtpCode(value);
    if (otpError) {
      setOtpError('');
    }

    // Auto-verify when all digits are filled
    if (value.length === OTP_LENGTH && !isVerifying) {
      verifyOtpCode(value);
    }
  };

  const buildUserPayload = (
    completion: Awaited<ReturnType<typeof completePasswordlessSignIn>>,
  ): User => ({
    id: completion.user.userId,
    email: completion.attributes.email ?? completion.user.username,
    firstName: completion.attributes.given_name,
    lastName: completion.attributes.family_name,
    phone: completion.attributes.phone_number,
    dateOfBirth: completion.attributes.birthdate,
    profilePicture: completion.attributes.picture,
    profileToken: completion.profile.profileToken,
  });

  const verifyOtpCode = async (code: string) => {
    if (code.length !== OTP_LENGTH) {
      setOtpError(`Please enter the ${OTP_LENGTH}-digit code.`);
      return;
    }

    setIsVerifying(true);

    try {
      const completion = await completePasswordlessSignIn(code);
      setOtpError('');
      const userPayload = buildUserPayload(completion);
      const tokens = completion.tokens;

      if (completion.profile.exists) {
        await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
        DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);
        await login(userPayload, tokens);
      } else {
        const createAccountPayload: AuthStackParamList['CreateAccount'] = {
          email: userPayload.email,
          userId: userPayload.id,
          profileToken: completion.profile.profileToken,
          tokens,
          initialAttributes: {
            firstName: userPayload.firstName,
            lastName: userPayload.lastName,
            phone: userPayload.phone,
            dateOfBirth: userPayload.dateOfBirth,
          },
          showOtpSuccess: true,
        };
        await AsyncStorage.setItem(
          PENDING_PROFILE_STORAGE_KEY,
          JSON.stringify(createAccountPayload),
        );
        DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);
        navigation.reset({
          index: 0,
          routes: [{name: 'CreateAccount', params: createAccountPayload}],
        });
      }
    } catch (error) {
      const formatted = formatAuthError(error);
      if (formatted === 'Unexpected authentication error. Please retry.') {
        setOtpError('The code you entered is incorrect. Please try again.');
      } else {
        setOtpError(formatted);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyCode = async () => {
    await verifyOtpCode(otpCode);
  };

  const handleResendOTP = async () => {
    if (!canResend || isResending) {
      return;
    }

    try {
      setIsResending(true);
      await requestPasswordlessEmailCode(email);
      setCountdown(RESEND_SECONDS);
      setCanResend(false);
      setOtpError('');
    } catch (error) {
      setOtpError(formatAuthError(error));
    } finally {
      setIsResending(false);
    }
  };

  const handleGoBack = useCallback(() => {
    const resetFlow = async () => {
      try {
        // Clear any pending profile so AppNavigator doesn't route back into CreateAccount
        await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to clear pending profile state', error);
      }

      DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);

      // Use global logout for provider-aware sign out and token clearing
      await logout();
      // Do not perform nested navigation.reset here;
      // AppNavigator will re-render into Auth flow cleanly.
    };

    resetFlow();
  }, [logout]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleGoBack();
        return true;
      },
    );

    return () => subscription.remove();
  }, [handleGoBack]);

  const isVerifyDisabled = isVerifying || otpCode.length !== OTP_LENGTH;

  return (
    <SafeArea style={styles.container}>
      <Header title="Enter login code" showBackButton onBack={handleGoBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Image
              source={Images.catLaptop}
              style={styles.illustration}
              resizeMode="contain"
            />

            <Text style={styles.subtitle}>Check your email</Text>

            <Text style={styles.description}>
              We've sent a {OTP_LENGTH}-digit login code to{' '}
              <Text style={styles.emailText}>{email}</Text>.
              {isNewUser
                ? ' Enter the code to create your Yosemite Crew account.'
                : ' Enter the code to continue.'}
            </Text>

            <OTPInput
              length={OTP_LENGTH}
              onComplete={handleOtpFilled}
              error={otpError}
              autoFocus
            />
          </View>
        </ScrollView>

        <View style={styles.bottomSection}>
          <LiquidGlassButton
            title={isVerifying ? 'Verifying...' : 'Verify code'}
            onPress={handleVerifyCode}
            style={styles.verifyButton}
            textStyle={styles.verifyButtonText}
            tintColor={isVerifyDisabled ? '#A09F9F' : theme.colors.secondary}
            height={56}
            borderRadius={16}
            loading={isVerifying}
            disabled={isVerifyDisabled}
          />

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            {canResend ? (
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={isResending}
                style={styles.resendButton}>
                {isResending ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Text style={styles.resendLink}>Resend</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.countdownText}>
                00:{countdown.toString().padStart(2, '0')} sec
              </Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: 100,
      paddingHorizontal: 20,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 20,
    },
    illustration: {
      width: '80%',
      height: '30%',
      marginBottom: 22,
    },
    subtitle: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      marginBottom: 16,
      textAlign: 'center',
    },
    description: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22.4,
    },
    emailText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    bottomSection: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      paddingTop: 20,
      backgroundColor: theme.colors.background,
    },
    verifyButton: {
      width: '100%',
      marginBottom: 24,
    },
    verifyButtonText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
    resendContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    resendText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
    resendButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    resendLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
    countdownText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
  });
