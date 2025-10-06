import React from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import {SafeArea} from '../../components/common';
import {LiquidGlassButton} from '../../components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';

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

interface SignUpScreenProps {
  navigation: any;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const handleSignUp = () => {
    navigation.navigate('SignUp');
  };

  const handleSignIn = () => {
    navigation.navigate('SignIn');
  };

  const handleGoogleSignUp = () => {
    // TODO: Implement Google sign up
  };

  const handleFacebookSignUp = () => {
    // TODO: Implement Facebook sign up
  };

  const handleAppleSignUp = () => {
    // TODO: Implement Apple sign up
  };

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
            />

            <LiquidGlassButton
              title="Sign up with Facebook"
              onPress={handleFacebookSignUp}
              style={styles.facebookButton}
              textStyle={styles.socialButtonText}
              height={56}
              borderRadius="lg"
              leftIcon={<FacebookIcon />}
            />

            <LiquidGlassButton
              title="Sign up with Apple"
              onPress={handleAppleSignUp}
              style={styles.appleButton}
              textStyle={styles.socialButtonText}
              height={56}
              borderRadius="lg"
              leftIcon={<AppleIcon />}
            />
          </View>

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
