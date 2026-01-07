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
  Keyboard,
  useWindowDimensions,
} from 'react-native';
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

const useKeyboardVisibility = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
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
  }, [hasStatusMessageParam, navigation, routeEmail, routeStatusMessage, setEmailValue, setStatusMessage]);
};

const useOTPHandler = (
  emailValue: string,
  allowReviewLogin: boolean,
  setEmailError: (error: string) => void,
  setStatusMessage: (message: string) => void,
  setIsSubmitting: (submitting: boolean) => void,
  navigation: SignInScreenProps['navigation'],
) => {
  const validateEmailInput = React.useCallback((email: string): string | null => {
    if (email.trim().length === 0) {
      return 'Please enter your email address';
    }
    if (!isValidEmail(email.trim())) {
      return 'Please enter a valid email address';
    }
    return null;
  }, []);

  const handleSendOTP = React.useCallback(async () => {
    const validationError = validateEmailInput(emailValue);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    setEmailError('');
    setIsSubmitting(true);
    try {
      const normalizedEmail = emailValue.trim();
      const lowerCasedEmail = normalizedEmail.toLowerCase();
      const isDemoLogin = allowReviewLogin && lowerCasedEmail === DEMO_LOGIN_EMAIL;
      console.log('[Auth] Sending OTP request', { normalizedEmail });
      const result = await requestPasswordlessEmailCode(normalizedEmail);
      console.log('[Auth] OTP request succeeded', result);

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
  }, [emailValue, allowReviewLogin, navigation, validateEmailInput, setEmailError, setStatusMessage, setIsSubmitting]);

  return { handleSendOTP };
};

const getKeyboardVisibleIllustrationHeight = (screenHeight: number) => {
  return Math.min(screenHeight * 0.22, 180);
};

const getKeyboardHiddenIllustrationHeight = (screenHeight: number) => {
  return Math.min(screenHeight * 0.32, 260);
};

const useIllustrationHeight = (isKeyboardVisible: boolean, screenHeight: number) => {
  return React.useMemo(() => {
    return isKeyboardVisible
      ? getKeyboardVisibleIllustrationHeight(screenHeight)
      : getKeyboardHiddenIllustrationHeight(screenHeight);
  }, [isKeyboardVisible, screenHeight]);
};

const getSocialButtonTintColor = (theme: any, color: string) => {
  return Platform.OS === 'ios' ? color : undefined;
};

const getSocialButtonStyle = (styles: any, theme: any, backgroundColor: string) => {
  const baseStyle = styles.socialButton;
  if (Platform.OS === 'ios') {
    return baseStyle;
  }
  return { ...baseStyle, backgroundColor };
};

const SocialAuthSection: React.FC<{
  theme: any;
  styles: any;
  isSocialLoading: boolean;
  activeProvider: SocialProvider | null;
  socialError: string;
  onGooglePress: () => void;
  onFacebookPress: () => void;
  onApplePress: () => void;
}> = ({
  theme,
  styles,
  isSocialLoading,
  activeProvider,
  socialError,
  onGooglePress,
  onFacebookPress,
  onApplePress,
}) => (
  <View style={styles.bottomSection}>
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>Login via</Text>
      <View style={styles.dividerLine} />
    </View>

    <View style={styles.socialButtons}>
      <LiquidGlassButton
        onPress={onGooglePress}
        customContent={<GoogleIcon />}
        disabled={isSocialLoading}
        loading={activeProvider === 'google'}
        tintColor={getSocialButtonTintColor(theme, theme.colors.cardBackground)}
        height={60}
        width={112}
        borderRadius={20}
        forceBorder
        borderColor={theme.colors.border}
        style={getSocialButtonStyle(styles, theme, theme.colors.cardBackground)}
      />
      <LiquidGlassButton
        onPress={onFacebookPress}
        customContent={<FacebookIcon />}
        disabled={isSocialLoading}
        loading={activeProvider === 'facebook'}
        tintColor={getSocialButtonTintColor(theme, theme.colors.primary)}
        height={60}
        width={112}
        borderRadius={20}
        style={getSocialButtonStyle(styles, theme, theme.colors.primary)}
      />
      <LiquidGlassButton
        onPress={onApplePress}
        customContent={<AppleIcon />}
        disabled={isSocialLoading}
        loading={activeProvider === 'apple'}
        tintColor={getSocialButtonTintColor(theme, theme.colors.secondary)}
        height={60}
        width={112}
        borderRadius={20}
        style={getSocialButtonStyle(styles, theme, theme.colors.secondary)}
      />
    </View>
    {socialError ? (
      <Text style={styles.socialErrorText}>{socialError}</Text>
    ) : null}
  </View>
);

export const SignInScreen: React.FC<SignInScreenProps> = ({navigation, route}) => {
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
  const {height: screenHeight} = useWindowDimensions();
  const illustrationHeight = useIllustrationHeight(isKeyboardVisible, screenHeight);

  const clearAllErrors = React.useCallback(() => {
    setEmailError('');
    setStatusMessage('');
    setSocialError('');
  }, []);

  const socialAuthConfig = React.useMemo(() => ({
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
  }), [clearAllErrors, login, navigation]);

  const {activeProvider, isSocialLoading, handleSocialAuth} = useSocialAuth(socialAuthConfig);

  useRouteParamsRestore(route, navigation, setEmailValue, setStatusMessage);

  const {handleSendOTP} = useOTPHandler(
    emailValue,
    allowReviewLogin,
    setEmailError,
    setStatusMessage,
    setIsSubmitting,
    navigation,
  );

  const attemptSocialAuth = React.useCallback(async (provider: SocialProvider) => {
    try {
      await handleSocialAuth(provider);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "We couldn't sign you in. Kindly retry.";
      setSocialError(message);
    }
  }, [handleSocialAuth]);

  const navigateToSignUp = React.useCallback(() => {
    navigation.navigate('SignUp');
  }, [navigation]);

  const handleEmailChange = React.useCallback((text: string) => {
    setEmailValue(text);
    clearAllErrors();
  }, [clearAllErrors]);

  const handleGoogleSignIn = React.useCallback(() => attemptSocialAuth('google'), [attemptSocialAuth]);
  const handleFacebookSignIn = React.useCallback(() => attemptSocialAuth('facebook'), [attemptSocialAuth]);
  const handleAppleSignIn = React.useCallback(() => attemptSocialAuth('apple'), [attemptSocialAuth]);

  return (
    <SafeArea style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
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
          <Image
            source={Images.authIllustration}
            style={[styles.illustration, {height: illustrationHeight}]}
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
          />
        )}
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
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['14'],
    },
    scrollContentKeyboard: {
      paddingBottom: theme.spacing['26'],
    },
    content: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
      paddingBottom: theme.spacing['5'],
    },
    illustration: {
      width: '100%',
      maxHeight: 260,
      minHeight: 140,
      marginBottom: theme.spacing['4'],
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['6'],
      textAlign: 'center',
    },
    formContainer: {
      width: '100%',
    },
    inputContainer: {
      minHeight: 70,
      marginBottom: theme.spacing['5'],
    },
    input: {
      flex: 1,
    },
    sendButton: {
      marginBottom: theme.spacing['6'],
      height: 52,
      borderRadius: theme.borderRadius.lg,
    },
    sendButtonText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
    statusMessage: {
      ...theme.typography.paragraph,
      color: theme.colors.success,
      textAlign: 'center',
      marginBottom: theme.spacing['4'],
    },
    demoBox: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing['4'],
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    demoHeader: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    demoText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
    demoButton: {
      marginTop: theme.spacing['1'],
      backgroundColor: theme.colors.white,
    },
    demoButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
    footerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing['7'],
    },
    footerText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    signUpLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
    bottomSection: {
      paddingHorizontal: theme.spacing['14'],
      paddingBottom: theme.spacing['10'],
      paddingTop: theme.spacing['5'],
      backgroundColor: theme.colors.background,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing['6'],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      marginHorizontal: theme.spacing['4'],
      ...theme.typography.screenTitle,
      color: theme.colors.textSecondary,
    },
    socialButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    socialButton: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    socialErrorText: {
      ...theme.typography.paragraph,
      color: theme.colors.error,
      textAlign: 'center',
      marginTop: theme.spacing['4'],
    },
  });
