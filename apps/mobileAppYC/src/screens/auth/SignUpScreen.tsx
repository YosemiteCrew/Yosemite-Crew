/* eslint-disable react-native/no-inline-styles */
import React, {useState} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import {SafeArea} from '../../components/common';
import {LiquidGlassButton} from '../../components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme, useSocialAuth, type SocialProvider} from '@/hooks';
import {Images} from '../../assets/images';
import {useAuth} from '@/contexts/AuthContext';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../../navigation/AuthNavigator';

// Icon components
const EmailIcon = () => (
  <Image
    source={Images.emailIcon}
    style={{width: 25, height: 25}}
    resizeMode="contain"
  />
);

const GoogleIcon = () => (
  <Image
    source={Images.googleIcon}
    style={{width: 25, height: 25}}
    resizeMode="contain"
  />
);

const FacebookIcon = () => (
  <Image
    source={Images.facebookIcon}
    style={{width: 25, height: 25}}
    resizeMode="contain"
  />
);

const AppleIcon = () => (
  <Image
    source={Images.appleIcon}
    style={{width: 25, height: 25}}
    resizeMode="contain"
  />
);

type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<SignUpScreenProps> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {login} = useAuth();
  const [socialError, setSocialError] = useState('');
  const {activeProvider, isSocialLoading, handleSocialAuth} = useSocialAuth({
    onStart: () => {
      setSocialError('');
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
    genericErrorMessage: 'We couldn’t complete the sign up. Kindly retry.',
  });

  const handleSignUp = () => {
    navigation.navigate('SignIn');
  };

  const handleSignIn = () => {
    navigation.navigate('SignIn');
  };

  const attemptSocialAuth = async (provider: SocialProvider) => {
    try {
      await handleSocialAuth(provider);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We couldn’t complete the sign up. Kindly retry.';
      setSocialError(message);
    }
  };

  const handleGoogleSignUp = () => attemptSocialAuth('google');

  const handleFacebookSignUp = () => attemptSocialAuth('facebook');

  const handleAppleSignUp = () => attemptSocialAuth('apple');

  return (
    <SafeArea style={styles.container}>
      <View style={styles.content}>
        {/* Hero Image */}
        <View style={styles.imageContainer}>
          <Image
            source={Images.welcomeIllustration}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Title */}
          <Text style={styles.title}>All companions, one place</Text>

          {/* Sign Up Buttons */}
          <View style={styles.buttonContainer}>
            <LiquidGlassButton
              title="Sign up with email"
              onPress={handleSignUp}
              style={styles.emailButton}
              textStyle={styles.emailButtonText}
              tintColor={theme.colors.secondary}
              height={56}
              borderRadius="lg"
              leftIcon={<EmailIcon />}
            />

            <LiquidGlassButton
              title="Sign up with Google"
              onPress={handleGoogleSignUp}
              style={styles.socialButton}
              textStyle={styles.socialButtonTextGoogle}
              tintColor={theme.colors.cardBackground}
              height={56}
              borderRadius="lg"
              shadowIntensity="medium" // Adds more shadow for visibility
              forceBorder={true}
              leftIcon={<GoogleIcon />}
              loading={activeProvider === 'google'}
              disabled={isSocialLoading}
            />

            <LiquidGlassButton
              title="Sign up with Facebook"
              onPress={handleFacebookSignUp}
              style={styles.facebookButton}
              textStyle={styles.socialButtonText}
              tintColor={theme.colors.primary}
              height={56}
              borderRadius="lg"
              leftIcon={<FacebookIcon />}
              loading={activeProvider === 'facebook'}
              disabled={isSocialLoading}
            />

            <LiquidGlassButton
              title="Sign up with Apple"
              onPress={handleAppleSignUp}
              style={styles.appleButton}
              textStyle={styles.socialButtonText}
              tintColor={theme.colors.secondary}
              height={56}
              borderRadius="lg"
              leftIcon={<AppleIcon />}
              loading={activeProvider === 'apple'}
              disabled={isSocialLoading}
            />
          </View>

          {socialError ? (
            <Text style={styles.socialErrorText}>{socialError}</Text>
          ) : null}

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already a member? </Text>
            <TouchableOpacity onPress={handleSignIn}>
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
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
    content: {
      flex: 1,
    },
    imageContainer: {
      width: '100%',
      height: '45%',
    },
    illustration: {
      width: '100%',
      height: '100%',
    },
    mainContent: {
      flex: 1,
      paddingTop: 12,
      paddingBottom: 40,
      justifyContent: 'space-between',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    buttonContainer: {
      paddingHorizontal: 24,
      gap: 16,
      paddingTop: 20,
    },
    emailButton: {
      backgroundColor: theme.colors.secondary,
      borderRadius: 16,
    },
    emailButtonText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
    socialButton: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.white,
      borderRadius: 16,
    },
    socialButtonTextGoogle: {
      ...theme.typography.cta,
      color: theme.colors.text,
    },
    facebookButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 16,
    },
    appleButton: {
      backgroundColor: theme.colors.secondary,
      borderRadius: 16,
    },
    socialButtonText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
    socialErrorText: {
      ...theme.typography.paragraph,
      color: theme.colors.error ?? '#D64545',
      textAlign: 'center',
      marginTop: 12,
      paddingHorizontal: 32,
    },
    signInContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 24,
    },
    signInText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    signInLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
  });
