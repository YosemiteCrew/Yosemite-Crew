import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {SafeArea, Input} from '@/shared/components/common';
import {useTheme, useSocialAuth, type SocialProvider} from '@/hooks';
import {Images} from '@/assets/images';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {
  requestPasswordlessEmailCode,
  formatAuthError,
} from '@/features/auth/services/passwordlessAuth';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '@/navigation/AuthNavigator';
import {useAuth} from '@/features/auth/context/AuthContext';
import {isValidEmail} from '@/shared/constants/constants';

const socialIconStyles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
  },
});

const GoogleIcon = () => (
  <Image source={Images.googleIcon} style={socialIconStyles.icon} resizeMode="contain" />
);

const FacebookIcon = () => (
  <Image source={Images.facebookIcon} style={socialIconStyles.icon} resizeMode="contain" />
);

const AppleIcon = () => (
  <Image source={Images.appleIcon} style={socialIconStyles.icon} resizeMode="contain" />
);


type SignInScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export const SignInScreen: React.FC<SignInScreenProps> = ({navigation, route}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {login} = useAuth();

  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialError, setSocialError] = useState('');

  const {activeProvider, isSocialLoading, handleSocialAuth} = useSocialAuth({
    onStart: () => {
      setSocialError('');
      setStatusMessage('');
      setEmailError('');
    },
    onExistingProfile: async result => {
      await login(result.user, result.tokens);
    },
    onNewProfile: async createAccountPayload => {
      navigation.reset({
        index: 0,
        routes: [{name: 'CreateAccount', params: createAccountPayload}],
      });
    },
    genericErrorMessage: 'We couldn’t sign you in. Kindly retry.',
  });

  const routeEmail = route.params?.email;
  const routeStatusMessage = route.params?.statusMessage;
  const hasStatusMessageParam = route.params
    ? Object.hasOwn(route.params, 'statusMessage')
    : false;

  useEffect(() => {
    const shouldSkipRestore = routeEmail == null && hasStatusMessageParam === false;
    if (shouldSkipRestore) {
      return;
    }

    console.log('[Auth] Restoring sign-in state from params', {
      email: routeEmail,
      statusMessage: routeStatusMessage,
      hasStatusMessageParam,
    });

    if (routeEmail) {
      setEmailValue(routeEmail);
    }

    if (hasStatusMessageParam) {
      setStatusMessage(routeStatusMessage ?? '');
    }

    navigation.setParams({ email: undefined, statusMessage: undefined });
  }, [hasStatusMessageParam, navigation, routeEmail, routeStatusMessage]);

  const validateEmail = (email: string) => isValidEmail(email);

  const handleSendOTP = async () => {
    if (emailValue.trim().length === 0) {
      setEmailError('Please enter your email address');
      return;
    }

    if (validateEmail(emailValue.trim()) === false) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError('');
    setIsSubmitting(true);
    try {
      const normalizedEmail = emailValue.trim();
      console.log('[Auth] Sending OTP request', { normalizedEmail });
      const result = await requestPasswordlessEmailCode(normalizedEmail);
      console.log('[Auth] OTP request succeeded', result);
      setStatusMessage(`We sent a login code to ${result.destination}`);
      navigation.navigate('OTPVerification', {
        email: result.destination,
        isNewUser: result.isNewUser,
      });
    } catch (error) {
      console.error('[Auth] Failed requesting passwordless code', error);
      setEmailError(formatAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const attemptSocialAuth = async (provider: SocialProvider) => {
    try {
      await handleSocialAuth(provider);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We couldn’t sign you in. Kindly retry.';
      setSocialError(message);
    }
  };

  const navigateToSignUp = () => {
    navigation.navigate('SignUp');
  };

  const handleGoogleSignIn = () => attemptSocialAuth('google');

  const handleFacebookSignIn = () => attemptSocialAuth('facebook');

  const handleAppleSignIn = () => attemptSocialAuth('apple');

  const handleEmailChange = (text: string) => {
    setEmailValue(text);
    if (emailError) {
      setEmailError('');
    }
    if (statusMessage) {
      setStatusMessage('');
    }
    if (socialError) {
      setSocialError('');
    }
  };

  return (
    <SafeArea style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Image
              source={Images.authIllustration}
              style={styles.illustration}
              resizeMode="contain"
            />

            <Text style={styles.title}>Tail-wagging welcome!</Text>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Input
                  label="Email address"
                  value={emailValue}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  inputStyle={styles.input}
                  error={emailError}
                />
              </View>

              <LiquidGlassButton
                title="Send OTP"
                onPress={handleSendOTP}
                style={styles.sendButton}
                textStyle={styles.sendButtonText}
                loading={isSubmitting}
                disabled={isSubmitting}
                tintColor={theme.colors.secondary}
                height={56}
                borderRadius="lg"
              />

              {statusMessage ? (
                <Text style={styles.statusMessage}>{statusMessage}</Text>
              ) : null}

              <View style={styles.footerContainer}>
                <Text style={styles.footerText}>Not a member? </Text>
                <TouchableOpacity onPress={navigateToSignUp}>
                  <Text style={styles.signUpLink}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Bottom Section */}
        <View style={styles.bottomSection}>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Login via</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialButtons}>
            <LiquidGlassButton
              onPress={handleGoogleSignIn}
              customContent={<GoogleIcon />}
              disabled={isSocialLoading}
              loading={activeProvider === 'google'}
              tintColor={Platform.OS === 'ios' ? theme.colors.cardBackground : undefined}
              height={60}
              width={112}
              borderRadius={20}
              forceBorder
              borderColor={theme.colors.border}
              style={{
                ...styles.socialButton,
                ...(Platform.OS === 'ios'
                  ? {}
                  : {backgroundColor: theme.colors.cardBackground}),
              }}
            />
            <LiquidGlassButton
              onPress={handleFacebookSignIn}
              customContent={<FacebookIcon />}
              disabled={isSocialLoading}
              loading={activeProvider === 'facebook'}
              tintColor={Platform.OS === 'ios' ? theme.colors.primary : undefined}
              height={60}
              width={112}
              borderRadius={20}
              style={{
                ...styles.socialButton,
                ...(Platform.OS === 'ios'
                  ? {}
                  : {backgroundColor: theme.colors.primary}),
              }}
            />
            <LiquidGlassButton
              onPress={handleAppleSignIn}
              customContent={<AppleIcon />}
              disabled={isSocialLoading}
              loading={activeProvider === 'apple'}
              tintColor={Platform.OS === 'ios' ? theme.colors.secondary : undefined}
              height={60}
              width={112}
              borderRadius={20}
              style={{
                ...styles.socialButton,
                ...(Platform.OS === 'ios'
                  ? {}
                  : {backgroundColor: theme.colors.secondary}),
              }}
            />
          </View>
          {socialError ? (
            <Text style={styles.socialErrorText}>{socialError}</Text>
          ) : null}
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
      paddingHorizontal: 20,
    },
    content: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingBottom: 20,
    },
    illustration: {
      width: '100%',
      height: '60%',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      marginBottom: 24,
      marginTop: -10,
      textAlign: 'center',
    },
    formContainer: {
      width: '100%',
    },
    inputContainer: {
      minHeight: 70, // Changed from height: 70
      marginBottom: 20,
    },
    input: {
      flex: 1,
    },
    sendButton: {
      marginBottom: 24,
      height: 52,
      borderRadius: 16,
    },
    sendButtonText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
    statusMessage: {
      ...theme.typography.paragraph,
      color: theme.colors.success,
      textAlign: 'center',
      marginBottom: 16,
    },
    footerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 30,
    },
    footerText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    signUpLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
    // Bottom Section Styles
    bottomSection: {
      paddingHorizontal: 55,
      paddingBottom: 40,
      paddingTop: 20,
      backgroundColor: theme.colors.background,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 25,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      marginHorizontal: 16,
      ...theme.typography.screenTitle,
      color: theme.colors.textSecondary,
    },
    socialButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    socialButton: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    socialErrorText: {
      ...theme.typography.paragraph,
      color: theme.colors.error ?? '#D64545',
      textAlign: 'center',
      marginTop: 16,
    },
  });
