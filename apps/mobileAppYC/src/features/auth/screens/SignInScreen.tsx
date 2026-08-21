import React, {useEffect as useReactEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {SafeArea, Input} from '@/shared/components/common';
import {useTheme, useSocialAuth, type SocialProvider} from '@/hooks';
import {Images} from '@/assets/images';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {
  requestPasswordlessEmailCode,
  formatAuthError,
  DEMO_LOGIN_EMAIL,
} from '@/features/auth/services/passwordlessAuth';
import {AUTH_FEATURE_FLAGS} from '@/config/variables';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '@/navigation/AuthNavigator';
import {useAuth} from '@/features/auth/context/AuthContext';
import {isValidEmail} from '@/shared/constants/constants';
import type {Theme} from '@/theme';

// The Facebook and Apple marks ship as white glyphs, which measured ~1.06:1
// on the cream button. Both brands permit a solid mark on a light ground:
// Apple in black, Facebook in its brand blue. Google's is multicolour and must
// never be tinted.
const FACEBOOK_BRAND_BLUE = '#1877F2';
const APPLE_MARK_BLACK = '#000000';

const socialIconStyles = StyleSheet.create({
  icon: {
    width: 22,
    height: 22,
  },
  facebookIcon: {
    width: 22,
    height: 22,
    tintColor: FACEBOOK_BRAND_BLUE,
  },
  appleIcon: {
    width: 22,
    height: 22,
    tintColor: APPLE_MARK_BLACK,
  },
});

const GoogleIcon = () => (
  <Image
    source={Images.googleIcon}
    style={socialIconStyles.icon}
    resizeMode="contain"
  />
);

const FacebookIcon = () => (
  <Image
    source={Images.facebookIcon}
    style={socialIconStyles.facebookIcon}
    resizeMode="contain"
  />
);

const AppleIcon = () => (
  <Image
    source={Images.appleIcon}
    style={socialIconStyles.appleIcon}
    resizeMode="contain"
  />
);

type SignInScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

const useKeyboardVisibility = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useReactEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return isKeyboardVisible;
};

const useRouteParamsRestore = (
  route: SignInScreenProps['route'],
  navigation: SignInScreenProps['navigation'],
  setEmailValue: (value: string) => void,
  setStatusMessage: (value: string) => void,
) => {
  const routeEmail = route.params?.email;
  const routeStatusMessage = route.params?.statusMessage;
  const hasStatusMessageParam = route.params
    ? Object.hasOwn(route.params, 'statusMessage')
    : false;

  useReactEffect(() => {
    const shouldSkipRestore =
      routeEmail == null && hasStatusMessageParam === false;
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

    navigation.setParams({email: undefined, statusMessage: undefined});
  }, [
    hasStatusMessageParam,
    navigation,
    routeEmail,
    routeStatusMessage,
    setEmailValue,
    setStatusMessage,
  ]);
};

const useOTPHandler = (
  emailValue: string,
  allowReviewLogin: boolean,
  setEmailError: (error: string) => void,
  setStatusMessage: (message: string) => void,
  setIsSubmitting: (submitting: boolean) => void,
  navigation: SignInScreenProps['navigation'],
) => {
  const validateEmailInput = React.useCallback(
    (email: string): string | null => {
      if (email.trim().length === 0) {
        return 'Please enter your email address';
      }
      if (!isValidEmail(email.trim())) {
        return 'Please enter a valid email address';
      }
      return null;
    },
    [],
  );

  const handleSendOTP = React.useCallback(async () => {
    const validationError = validateEmailInput(emailValue);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    setEmailError('');
    setIsSubmitting(true);
    const normalizedEmail = emailValue.trim();
    const isDemoLogin =
      allowReviewLogin && normalizedEmail.toLowerCase() === DEMO_LOGIN_EMAIL;
    try {
      // requestPasswordlessEmailCode initializes SuperTokens against the
      // correct API domain (dev backend for the demo/review login).
      const result = await requestPasswordlessEmailCode(normalizedEmail);

      const message = isDemoLogin
        ? 'App Review login: use the provided password to continue. No email is sent.'
        : `We sent a login code to ${result.destination}`;
      setStatusMessage(message);

      navigation.navigate('OTPVerification', {
        email: result.destination,
        isNewUser: result.isNewUser,
        challengeType: isDemoLogin ? 'demoPassword' : 'otp',
        challengeLength: isDemoLogin ? result.challengeLength : undefined,
      });
    } catch (error) {
      console.error('[Auth] Failed requesting passwordless code', error);
      setEmailError(formatAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    emailValue,
    allowReviewLogin,
    navigation,
    validateEmailInput,
    setEmailError,
    setStatusMessage,
    setIsSubmitting,
  ]);

  return {handleSendOTP};
};

const SocialAuthSection: React.FC<{
  theme: Theme;
  styles: any;
  isSocialLoading: boolean;
  activeProvider: SocialProvider | null;
  socialError: string;
  onGooglePress: () => void;
  onFacebookPress: () => void;
  onApplePress: () => void;
  onCreateAccountPress: () => void;
}> = ({
  theme,
  styles,
  isSocialLoading,
  activeProvider,
  socialError,
  onGooglePress,
  onFacebookPress,
  onApplePress,
  onCreateAccountPress,
}) => (
  <View style={styles.bottomSection}>
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>

    <View style={styles.socialButtons}>
      <PressableOpacity
        onPress={onGooglePress}
        disabled={isSocialLoading}
        style={styles.socialButton}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google">
        {activeProvider === 'google' ? (
          <ActivityIndicator size="small" color={theme.colors.inkMuted} />
        ) : (
          <GoogleIcon />
        )}
      </PressableOpacity>
      <PressableOpacity
        onPress={onFacebookPress}
        disabled={isSocialLoading}
        style={styles.socialButton}
        accessibilityRole="button"
        accessibilityLabel="Continue with Facebook">
        {activeProvider === 'facebook' ? (
          <ActivityIndicator size="small" color={theme.colors.inkMuted} />
        ) : (
          <FacebookIcon />
        )}
      </PressableOpacity>
      <PressableOpacity
        onPress={onApplePress}
        disabled={isSocialLoading}
        style={styles.socialButton}
        accessibilityRole="button"
        accessibilityLabel="Continue with Apple">
        {activeProvider === 'apple' ? (
          <ActivityIndicator size="small" color={theme.colors.inkMuted} />
        ) : (
          <AppleIcon />
        )}
      </PressableOpacity>
    </View>
    {socialError ? (
      <Text style={styles.socialErrorText}>{socialError}</Text>
    ) : null}

    <View style={styles.footerContainer}>
      <Text style={styles.footerText}>New here? </Text>
      <PressableOpacity
        onPress={onCreateAccountPress}
        accessibilityRole="button"
        accessibilityLabel="Create an account">
        <Text style={styles.signUpLink}>Create an account</Text>
      </PressableOpacity>
    </View>
  </View>
);

export const SignInScreen: React.FC<SignInScreenProps> = ({
  navigation,
  route,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {login} = useAuth();
  const allowReviewLogin = AUTH_FEATURE_FLAGS.enableReviewLogin === true;

  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialError, setSocialError] = useState('');
  const isKeyboardVisible = useKeyboardVisibility();

  const clearAllErrors = React.useCallback(() => {
    setEmailError('');
    setStatusMessage('');
    setSocialError('');
  }, []);

  const socialAuthConfig = React.useMemo(
    () => ({
      onStart: clearAllErrors,
      onExistingProfile: async (result: any) => {
        await login(result.user, result.tokens);
      },
      onNewProfile: async (createAccountPayload: any) => {
        navigation.reset({
          index: 0,
          routes: [{name: 'CreateAccount', params: createAccountPayload}],
        });
      },
      genericErrorMessage: "We couldn't sign you in. Kindly retry.",
    }),
    [clearAllErrors, login, navigation],
  );

  const {activeProvider, isSocialLoading, handleSocialAuth} =
    useSocialAuth(socialAuthConfig);

  useRouteParamsRestore(route, navigation, setEmailValue, setStatusMessage);

  const {handleSendOTP} = useOTPHandler(
    emailValue,
    allowReviewLogin,
    setEmailError,
    setStatusMessage,
    setIsSubmitting,
    navigation,
  );

  const attemptSocialAuth = React.useCallback(
    async (provider: SocialProvider) => {
      try {
        await handleSocialAuth(provider);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "We couldn't sign you in. Kindly retry.";
        setSocialError(message);
      }
    },
    [handleSocialAuth],
  );

  const navigateToSignUp = React.useCallback(() => {
    navigation.navigate('SignUp');
  }, [navigation]);

  const handleGoBack = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleEmailChange = React.useCallback(
    (text: string) => {
      setEmailValue(text);
      clearAllErrors();
    },
    [clearAllErrors],
  );

  const handleGoogleSignIn = React.useCallback(
    () => attemptSocialAuth('google'),
    [attemptSocialAuth],
  );
  const handleFacebookSignIn = React.useCallback(
    () => attemptSocialAuth('facebook'),
    [attemptSocialAuth],
  );
  const handleAppleSignIn = React.useCallback(
    () => attemptSocialAuth('apple'),
    [attemptSocialAuth],
  );

  return (
    <SafeArea style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.header}>
          <PressableOpacity
            onPress={handleGoBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Image
              source={Images.backIcon}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </PressableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible && styles.scrollContentKeyboard,
          ]}>
          <View style={styles.content}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                We'll email you a login code. No password to remember.
              </Text>
            </View>

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
                tintColor={theme.colors.cta}
                height={56}
                borderRadius="button"
              />

              {statusMessage ? (
                <Text style={styles.statusMessage}>{statusMessage}</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>

        {!isKeyboardVisible && (
          <SocialAuthSection
            theme={theme}
            styles={styles}
            isSocialLoading={isSocialLoading}
            activeProvider={activeProvider}
            socialError={socialError}
            onGooglePress={handleGoogleSignIn}
            onFacebookPress={handleFacebookSignIn}
            onApplePress={handleAppleSignIn}
            onCreateAccountPress={navigateToSignUp}
          />
        )}
      </KeyboardAvoidingView>
    </SafeArea>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.screen,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['2'],
      paddingBottom: theme.spacing['1'],
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: {
      width: 20,
      height: 20,
      tintColor: theme.colors.inkBody,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['14'],
    },
    scrollContentKeyboard: {
      paddingBottom: theme.spacing['16'],
    },
    content: {
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      width: '100%',
      paddingBottom: theme.spacing['5'],
    },
    titleBlock: {
      marginBottom: theme.spacing['7'],
    },
    title: {
      ...theme.typography.serifTitle,
      color: theme.colors.ink,
      marginBottom: theme.spacing['2'],
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
    },
    formContainer: {
      width: '100%',
    },
    inputContainer: {
      marginBottom: theme.spacing['5'],
    },
    input: {
      flex: 1,
    },
    sendButton: {
      marginTop: theme.spacing['1'],
      ...theme.shadows.cta,
    },
    sendButtonText: {
      ...theme.typography.buttonLarge,
      fontSize: 16.5,
      lineHeight: 20,
      color: theme.colors.ctaText,
    },
    statusMessage: {
      ...theme.typography.bodySmall,
      color: theme.colors.success,
      textAlign: 'center',
      marginTop: theme.spacing['4'],
    },
    bottomSection: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['10'],
      paddingTop: theme.spacing['4'],
      backgroundColor: theme.colors.screen,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing['6'],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.hairline,
    },
    dividerText: {
      marginHorizontal: theme.spacing['4'],
      ...theme.typography.bodySmall,
      color: theme.colors.inkFaint2,
    },
    socialButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    socialButton: {
      flex: 1,
      height: 52,
      borderRadius: theme.borderRadius.field,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      backgroundColor: theme.colors.screen,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    socialErrorText: {
      ...theme.typography.bodySmall,
      color: theme.colors.error,
      textAlign: 'center',
      marginTop: theme.spacing['4'],
    },
    footerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing['7'],
    },
    footerText: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
    },
    signUpLink: {
      ...theme.typography.bodyMedium,
      color: theme.colors.blueText,
    },
  });
