import React, {useState, useMemo} from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {SafeArea} from '@/shared/components/common';
import {useTheme, useSocialAuth, type SocialProvider} from '@/hooks';
import {Images} from '@/assets/images';
import {useAuth} from '@/features/auth/context/AuthContext';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '@/navigation/AuthNavigator';
import type {Theme} from '@/theme';

const LOGO = require('../../../assets/images/yosemite-logo-1024.png');

type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const socialButtons: {
  provider: SocialProvider;
  label: string;
  icon: number;
}[] = [
  {provider: 'google', label: 'Sign up with Google', icon: Images.googleIcon},
  {
    provider: 'facebook',
    label: 'Sign up with Facebook',
    icon: Images.facebookIcon,
  },
  {provider: 'apple', label: 'Sign up with Apple', icon: Images.appleIcon},
];

export const SignUpScreen: React.FC<SignUpScreenProps> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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

  const handleEmailSignUp = () => {
    navigation.navigate('SignIn');
  };

  const handleSignIn = () => {
    navigation.navigate('SignIn');
  };

  const handleOpenTerms = () => {
    navigation.navigate('TermsAndConditions');
  };

  const handleOpenPrivacy = () => {
    navigation.navigate('PrivacyPolicy');
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

  return (
    <SafeArea style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Free for pet parents. What's yours stays yours.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <PressableOpacity
            onPress={handleEmailSignUp}
            disabled={isSocialLoading}
            style={styles.emailButton}>
            <Image
              source={Images.emailIcon}
              style={[styles.buttonIcon, styles.emailIconTint]}
              resizeMode="contain"
            />
            <Text style={styles.emailButtonText}>Sign up with email</Text>
          </PressableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {socialButtons.map(({provider, label, icon}) => (
            <PressableOpacity
              key={provider}
              onPress={() => attemptSocialAuth(provider)}
              disabled={isSocialLoading}
              style={styles.socialButton}>
              <Image
                source={icon}
                style={styles.buttonIcon}
                resizeMode="contain"
              />
              <Text style={styles.socialButtonText}>
                {activeProvider === provider ? 'Please wait…' : label}
              </Text>
            </PressableOpacity>
          ))}
        </View>

        {socialError ? (
          <Text style={styles.socialErrorText}>{socialError}</Text>
        ) : null}

        <View style={styles.spacer} />

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing you agree to Yosemite Crew's{' '}
          <Text
            style={styles.termsLink}
            accessibilityRole="link"
            onPress={handleOpenTerms}>
            terms and conditions
          </Text>{' '}
          and{' '}
          <Text
            style={styles.termsLink}
            accessibilityRole="link"
            onPress={handleOpenPrivacy}>
            privacy policy
          </Text>
          .
        </Text>

        {/* Sign In Link */}
        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Already have an account? </Text>
          <PressableOpacity onPress={handleSignIn}>
            <Text style={styles.signInLink}>Sign in</Text>
          </PressableOpacity>
        </View>
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.screen,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'],
    },
    header: {
      paddingTop: theme.spacing['7'],
      gap: theme.spacing['1.25'],
    },
    logo: {
      width: 60,
      height: 60,
      marginBottom: theme.spacing['2.5'],
    },
    title: {
      ...theme.typography.serifTitle,
      color: theme.colors.ink,
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
    },
    buttonContainer: {
      gap: theme.spacing['3'],
      paddingTop: theme.spacing['6'],
    },
    emailButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2.5'],
      height: 54,
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.cta,
      ...theme.shadows.cta,
    },
    emailButtonText: {
      ...theme.typography.buttonLarge,
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.ctaText,
    },
    buttonIcon: {
      width: 20,
      height: 20,
    },
    emailIconTint: {
      tintColor: theme.colors.ctaText,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['1'],
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.hairline,
    },
    dividerText: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkFaint2,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2.5'],
      height: 54,
      borderRadius: theme.borderRadius.button,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      backgroundColor: theme.colors.screen,
    },
    socialButtonText: {
      ...theme.typography.buttonLarge,
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.inkBody,
    },
    socialErrorText: {
      ...theme.typography.bodySmall,
      color: theme.colors.error,
      textAlign: 'center',
      marginTop: theme.spacing['3'],
    },
    spacer: {
      flex: 1,
      minHeight: theme.spacing['6'],
    },
    terms: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkFaint,
      textAlign: 'center',
      paddingHorizontal: theme.spacing['6'],
      marginBottom: theme.spacing['4'],
    },
    termsLink: {
      color: theme.colors.blueText,
      fontFamily: theme.typography.bodyMedium.fontFamily,
    },
    signInContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing['4'],
    },
    signInText: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
    },
    signInLink: {
      ...theme.typography.bodyMedium,
      color: theme.colors.blueText,
    },
  });
