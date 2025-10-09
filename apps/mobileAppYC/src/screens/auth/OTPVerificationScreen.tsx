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
} from 'react-native';
import {SafeArea, OTPInput} from '../../components/common';
import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../../navigation/AuthNavigator';
import {
  completePasswordlessSignIn,
  formatAuthError,
  requestPasswordlessEmailCode,
  signOutEverywhere,
} from '@/services/auth/passwordlessAuth';
import {useAuth, type User} from '../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_PROFILE_STORAGE_KEY, PENDING_PROFILE_UPDATED_EVENT } from '@/config/variables';

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

  const handleVerifyCode = async () => {
    if (otpCode.length !== OTP_LENGTH) {
      setOtpError(`Please enter the ${OTP_LENGTH}-digit code.`);
      return;
    }

    setIsVerifying(true);

    try {
      const completion = await completePasswordlessSignIn(otpCode);
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
        await signOutEverywhere();
      } catch (error) {
        console.warn('Failed to sign out completely', error);
      }

      try {
        await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to clear pending profile state', error);
      }

      DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);

      await logout();

      navigation.reset({
        index: 0,
        routes: [{name: 'SignIn'}],
      });
    };

    resetFlow();
  }, [logout, navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoBack();
      return true;
    });

    return () => subscription.remove();
  }, [handleGoBack]);

  return (
    <SafeArea style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
            activeOpacity={0.7}>
            <Image
              source={Images.backIcon}
              style={[styles.backIcon, {tintColor: theme.colors.text}]}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Enter login code</Text>
          </View>
          <View style={styles.spacer} />
        </View>
      </View>

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
          tintColor={theme.colors.secondary}
          height={56}
          borderRadius={16}
          loading={isVerifying}
          disabled={isVerifying}
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

    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      paddingTop: 60,
      paddingHorizontal: 20,
      backgroundColor: theme.colors.background,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
      textAlign: 'center',
    },
    backButton: {
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    spacer: {
      width: 30,
      height: 30,
    },
    backIcon: {
      width: 30,
      height: 30,
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
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    emailText: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: 'bold',
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
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
    resendContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    resendText: {
      ...theme.typography.paragraphBold,
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
