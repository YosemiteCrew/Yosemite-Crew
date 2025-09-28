import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import {SafeArea, Input} from '../../components/common';
import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';

interface SignInScreenProps {
  navigation: any;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendOTP = () => {
    if (!email.trim()) {
      setEmailError('Please enter your email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError('');
    navigation.navigate('OTPVerification', {email: email.trim()});
  };

  const navigateToSignUp = () => {
    navigation.navigate('SignUp');
  };

  const handleGoogleSignIn = () => {
    // TODO: Implement Google sign in
    console.log('Google Sign In');
  };

  const handleFacebookSignIn = () => {
    // TODO: Implement Facebook sign in
    console.log('Facebook Sign In');
  };

  const handleAppleSignIn = () => {
    // TODO: Implement Apple sign in
    console.log('Apple Sign In');
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) {
      setEmailError('');
    }
  };

  return (
    <SafeArea style={styles.container}>
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
                value={email}
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
              tintColor={theme.colors.secondary}
              height={56}
              borderRadius={28}
            />

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
          <TouchableOpacity activeOpacity={0.8} onPress={handleGoogleSignIn}>
            <Image
              source={Images.googleTab}
              style={styles.socialTabIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={handleFacebookSignIn}>
            <Image
              source={Images.facebookTab}
              style={styles.socialTabIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={handleAppleSignIn}>
            <Image
              source={Images.appleTab}
              style={styles.socialTabIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
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
      height: '55%',
      marginBottom: 10,
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginBottom: 30,
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
      borderRadius: 26,
    },
    sendButtonText: {
      color: theme.colors.white,
      lineHeight: 30,
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
      paddingHorizontal: 20,
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
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    socialButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 20,
    },
    socialTabIcon: {
      width: 100,
      height: 60,
    },
  });
