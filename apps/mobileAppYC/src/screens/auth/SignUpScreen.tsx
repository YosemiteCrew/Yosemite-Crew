/* eslint-disable react-native/no-inline-styles */
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  DeviceEventEmitter,
} from 'react-native';
import {SafeArea} from '../../components/common';
import {LiquidGlassButton} from '../../components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';
import {useAuth} from '@/contexts/AuthContext';
import {
  signInWithSocialProvider,
  type SocialProvider,
} from '@/services/auth/socialAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../../navigation/AuthNavigator';
import { PENDING_PROFILE_STORAGE_KEY, PENDING_PROFILE_UPDATED_EVENT } from '@/config/variables';

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
  const [activeSocialProvider, setActiveSocialProvider] =
    useState<SocialProvider | null>(null);
  const isSocialLoading = activeSocialProvider !== null;

  const handleSignUp = () => {
    navigation.navigate('SignIn');
  };

  const handleSignIn = () => {
    navigation.navigate('SignIn');
  };

  const handleSocialAuth = async (provider: SocialProvider) => {
    if (activeSocialProvider) {
      return;
    }

    setSocialError('');
    setActiveSocialProvider(provider);

    try {
      const result = await signInWithSocialProvider(provider);

      if (result.profile.exists) {
        await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
        DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);
        await login(result.user, result.tokens);
        return;
      }

      const createAccountPayload: AuthStackParamList['CreateAccount'] = {
        email: result.user.email,
        userId: result.user.id,
        profileToken: result.profile.profileToken,
        tokens: result.tokens,
        initialAttributes: {
          firstName: result.initialAttributes.firstName,
          lastName: result.initialAttributes.lastName,
          profilePicture: result.initialAttributes.profilePicture,
        },
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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We could not complete the social sign-up. Please try again.';
      setSocialError(message);
    } finally {
      setActiveSocialProvider(null);
    }
  };

  const handleGoogleSignUp = () => handleSocialAuth('google');

  const handleFacebookSignUp = () => handleSocialAuth('facebook');

  const handleAppleSignUp = () => handleSocialAuth('apple');

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
              height={56}
              borderRadius="lg"
              leftIcon={<EmailIcon />}
            />

            <LiquidGlassButton
              title="Sign up with Google"
              onPress={handleGoogleSignUp}
              style={styles.socialButton}
              textStyle={styles.socialButtonTextGoogle}
              height={56}
              borderRadius="lg"
              shadowIntensity="medium" // Adds more shadow for visibility
              forceBorder={true}
              leftIcon={<GoogleIcon />}
              loading={activeSocialProvider === 'google'}
              disabled={isSocialLoading}
            />

            <LiquidGlassButton
              title="Sign up with Facebook"
              onPress={handleFacebookSignUp}
              style={styles.facebookButton}
              textStyle={styles.socialButtonText}
              height={56}
              borderRadius="lg"
              leftIcon={<FacebookIcon />}
              loading={activeSocialProvider === 'facebook'}
              disabled={isSocialLoading}
            />

            <LiquidGlassButton
              title="Sign up with Apple"
              onPress={handleAppleSignUp}
              style={styles.appleButton}
              textStyle={styles.socialButtonText}
              height={56}
              borderRadius="lg"
              leftIcon={<AppleIcon />}
              loading={activeSocialProvider === 'apple'}
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
      color: theme.colors.text,
      textAlign: 'center',
    },
    buttonContainer: {
      paddingHorizontal: 40,
      gap: 18,
      paddingTop: 20,
    },
    emailButton: {
      backgroundColor: theme.colors.secondary,
    },
    emailButtonText: {
      color: theme.colors.white,
      lineHeight: 30,
    },
    socialButton: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.white,
    },
    socialButtonTextGoogle: {
      color: theme.colors.text,
      lineHeight: 30,
    },
    facebookButton: {
      backgroundColor: '#247AED',
    },
    appleButton: {
      backgroundColor: theme.colors.secondary,
    },
    socialButtonText: {
      color: theme.colors.white,
      lineHeight: 30,
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
