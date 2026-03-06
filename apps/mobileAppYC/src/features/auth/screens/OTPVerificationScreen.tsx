import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {OTPInput, Header, Input} from '@/shared/components/common';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '@/navigation/AuthNavigator';
import {
  completePasswordlessSignIn,
  formatAuthError,
  requestPasswordlessEmailCode,
  signOutEverywhere,
  DEMO_LOGIN_PASSWORD,
  DEMO_LOGIN_EMAIL,
} from '@/features/auth/services/passwordlessAuth';
import {mergeUserWithParentProfile} from '@/features/auth/utils/parentProfileMapper';
import {useAuth, type User} from '@/features/auth/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_PROFILE_STORAGE_KEY,
  PENDING_PROFILE_UPDATED_EVENT,
  AUTH_FEATURE_FLAGS,
} from '@/config/variables';

const DEFAULT_OTP_LENGTH = 4;
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
  const {login} = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const allowReviewLogin = AUTH_FEATURE_FLAGS.enableReviewLogin === true;

  const {email, isNewUser, challengeType = 'otp', challengeLength} = route.params;
  const isDemoLogin =
    allowReviewLogin &&
    (challengeType === 'demoPassword' || email === DEMO_LOGIN_EMAIL);
  const expectedLength =
    challengeLength ??
    (isDemoLogin ? DEMO_LOGIN_PASSWORD.length : DEFAULT_OTP_LENGTH);

  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const cancellationRef = useRef(false);

  useEffect(() => {
    if (isDemoLogin) {
      return () => undefined;
    }

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
  }, [countdown, canResend, isDemoLogin]);

  const handleOtpFilled = (value: string) => {
    if (isDemoLogin) {
      return;
    }
    setOtpCode(value);
    if (otpError) {
      setOtpError('');
    }

    // Auto-verify when all digits are filled
    if (value.length === expectedLength && !isVerifying) {
      verifyOtpCode(value);
    }
  };

  const handlePasswordChange = (value: string) => {
    setOtpCode(value);
    if (otpError) {
      setOtpError('');
    }
  };

const buildUserPayload = (
  completion: Awaited<ReturnType<typeof completePasswordlessSignIn>>,
): User => {
  const baseUser: User = {
    id: completion.user.userId,
    parentId: completion.profile.parent?.id ?? undefined,
    email: completion.attributes.email ?? completion.user.username,
    firstName: completion.attributes.given_name,
    lastName: completion.attributes.family_name,
    phone: completion.attributes.phone_number,
    dateOfBirth: completion.attributes.birthdate,
    profilePicture: completion.attributes.picture,
    profileToken: completion.profile.profileToken,
    profileCompleted: completion.profile.isComplete,
  };

  return mergeUserWithParentProfile(baseUser, completion.profile.parent);
};

  const validateCode = (code: string): boolean => {
    const trimmed = code.trim();
    if (isDemoLogin && trimmed.length === 0) {
      setOtpError('Please enter the review password to continue.');
      return false;
    }
    if (!isDemoLogin && trimmed.length !== expectedLength) {
      setOtpError(`Please enter the ${expectedLength}-digit code.`);
      return false;
    }
    return true;
  };

  const handleLinkedParent = async (completion: Awaited<ReturnType<typeof completePasswordlessSignIn>>, userPayload: User, tokens: any) => {
    await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
    DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);
    await login(userPayload, tokens);
  };

  const handleNewAccount = async (completion: Awaited<ReturnType<typeof completePasswordlessSignIn>>, userPayload: User, tokens: any) => {
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
        profilePicture: userPayload.profilePicture,
        address: userPayload.address,
      },
      hasRemoteProfile: completion.profile.exists,
      existingParentProfile: completion.profile.parent ?? null,
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
  };

  const verifyOtpCode = async (code: string) => {
    if (cancellationRef.current || !validateCode(code)) {
      return;
    }

    setIsVerifying(true);
    try {
      const completion = await completePasswordlessSignIn(code.trim());
      if (cancellationRef.current) {
        return;
      }
      setOtpError('');
      const userPayload = buildUserPayload(completion);
      const tokens = completion.tokens;

      if (completion.parentLinked && completion.profile.parent) {
        await handleLinkedParent(completion, userPayload, tokens);
      } else {
        await handleNewAccount(completion, userPayload, tokens);
      }
    } catch (error) {
      const formatted = formatAuthError(error);
      setOtpError(formatted === 'Unexpected authentication error. Please retry.'
        ? 'The code you entered is incorrect. Please try again.'
        : formatted);
    } finally {
      if (!cancellationRef.current) {
        setIsVerifying(false);
      }
    }
  };

  const handleVerifyCode = async () => {
    if (!cancellationRef.current) {
      await verifyOtpCode(otpCode);
    }
  };

  const handleResendOTP = async () => {
    if (isDemoLogin || !canResend || isResending || cancellationRef.current) {
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
      if (!cancellationRef.current) {
        setIsResending(false);
      }
    }
  };

  const getButtonTitle = (): string => {
    if (isVerifying) return 'Verifying...';
    if (isDemoLogin) return 'Sign in with password';
    return 'Verify code';
  };

  const handleGoBack = useCallback(() => {
    const resetFlow = async () => {
      if (cancellationRef.current) {
        return;
      }
      cancellationRef.current = true;
      setIsVerifying(false);
      setIsResending(false);
      try {
        await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to clear pending profile state', error);
      }

      DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);

      try {
        await signOutEverywhere();
      } catch (error) {
        console.warn('[OTP] Failed to cancel Amplify session', error);
      }

      navigation.reset({
        index: 0,
        routes: [{name: 'SignIn'}],
      });
    };

    resetFlow();
  }, [navigation]);

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

  const isVerifyDisabled =
    isVerifying || (isDemoLogin ? otpCode.trim().length === 0 : otpCode.length !== expectedLength);

  return (
    <LiquidGlassHeaderScreen
      header={<Header title="Enter login code" showBackButton onBack={handleGoBack} glass={false} />}
      cardGap={theme.spacing['3']}
      contentPadding={theme.spacing['1']}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, contentPaddingStyle]}>
          <View style={styles.content}>
            <Image
              source={Images.catLaptop}
              style={styles.illustration}
              resizeMode="contain"
            />

            <Text style={styles.subtitle}>Check your email</Text>

            {isDemoLogin ? (
              <>
                <Text style={styles.description}>
                  This is the App Review login. No email was sent—use the provided review
                  password to sign in and continue to account creation.
                </Text>
                <Input
                  label="Review password"
                  value={otpCode}
                  onChangeText={handlePasswordChange}
                  autoCapitalize="none"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyCode}
                  autoFocus
                  containerStyle={styles.demoInputContainer}
                  error={otpError}
                />
                <TouchableOpacity
                  onPress={() => setOtpCode(DEMO_LOGIN_PASSWORD)}
                  style={styles.prefillButton}>
                  <Text style={styles.prefillText}>Use provided password</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.description}>
                  We've sent a {expectedLength}-digit login code to{' '}
                  <Text style={styles.emailText}>{email}</Text>.
                  {isNewUser
                    ? ' Enter the code to create your Yosemite Crew account.'
                    : ' Enter the code to continue.'}
                </Text>

                <OTPInput
                  length={expectedLength}
                  onComplete={handleOtpFilled}
                  error={otpError}
                  autoFocus
                />
              </>
            )}
            </View>
          </ScrollView>

          <View style={styles.bottomSection}>
          <LiquidGlassButton
            title={getButtonTitle()}
            onPress={handleVerifyCode}
            style={styles.verifyButton}
            textStyle={styles.verifyButtonText}
            tintColor={isVerifyDisabled ? '#A09F9F' : theme.colors.secondary}
            height={56}
            borderRadius={16}
            loading={isVerifying}
            disabled={isVerifyDisabled}
          />

          {isDemoLogin ? (
            <Text style={styles.resendText}>
              Need credentials? Use {DEMO_LOGIN_PASSWORD} with the review email you entered.
            </Text>
          ) : (
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
          )}
          </View>
        </KeyboardAvoidingView>
      )}
    </LiquidGlassHeaderScreen>
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
      paddingHorizontal: theme.spacing['5'],
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: theme.spacing['5'],
    },
    illustration: {
      width: '80%',
      height: '30%',
      marginBottom: theme.spacing['5'],
    },
    subtitle: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['4'],
      textAlign: 'center',
    },
    description: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22.4,
      marginBottom: theme.spacing['4'],
    },
    emailText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    bottomSection: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['10'],
      paddingTop: theme.spacing['5'],
      backgroundColor: theme.colors.background,
    },
    verifyButton: {
      width: '100%',
      marginBottom: theme.spacing['6'],
    },
    verifyButtonText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
    resendContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['1'],
    },
    resendText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
    resendButton: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
    },
    resendLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
    countdownText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
    demoInputContainer: {
      width: '100%',
    },
    prefillButton: {
      marginTop: theme.spacing['2'],
      paddingVertical: theme.spacing['2'],
      paddingHorizontal: theme.spacing['3'],
    },
    prefillText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
      textAlign: 'center',
    },
  });
