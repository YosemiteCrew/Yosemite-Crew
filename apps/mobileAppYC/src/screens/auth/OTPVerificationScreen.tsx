import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {SafeArea, OTPInput} from '../../components/common';
import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import CustomBottomSheet, {BottomSheetRef} from '../../components/common/BottomSheet/BottomSheet';

interface OTPVerificationScreenProps {
  navigation: any;
  route: {
    params: {
      email: string;
    };
  };
}

export const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const {theme} = useTheme();
  const {email} = route.params;
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(59);
  const [canResend, setCanResend] = useState(false);
  
  // Bottom sheet ref
  const successBottomSheetRef = useRef<BottomSheetRef>(null);

  const styles = createStyles(theme);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const handleOTPComplete = (otp: string) => {
    setOtpCode(otp);
    // Simulate OTP verification
    if (otp === '1234') {
      // Show success bottom sheet
      successBottomSheetRef.current?.snapToIndex(0);
      setOtpError('');
    } else {
      setOtpError('The codes do not match.');
    }
  };

  const handleVerifyCode = () => {
    if (otpCode.length === 4) {
      handleOTPComplete(otpCode);
    }
  };

  const handleResendOTP = () => {
    if (canResend) {
      setCountdown(59);
      setCanResend(false);
      setOtpError('');
      // TODO: Implement actual OTP resend logic
      console.log('Resending OTP to:', email);
    }
  };

  const handleSuccessClose = () => {
    successBottomSheetRef.current?.close();
    navigation.navigate('CreateAccount');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const renderSuccessContent = () => (
    <View style={styles.successContent}>
      <Image
        source={Images.verificationSuccess}
        style={styles.successIllustration}
        resizeMode="contain"
      />
      
      <Text style={styles.successTitle}>Code verified</Text>
      
      <Text style={styles.successMessage}>
        The code sent to your email{'\n'}
        <Text style={styles.successEmailText}>{email}</Text> has been successfully verified
      </Text>
      
      <LiquidGlassButton
        title="Okay"
        onPress={handleSuccessClose}
        style={styles.successButton}
        textStyle={styles.successButtonText}
        tintColor={theme.colors.secondary}
        height={56}
        borderRadius={16}
      />
    </View>
  );

  return (
    <SafeArea style={styles.container}>
      {/* Fixed Header */}
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
        {/* Center Content */}
        <View style={styles.content}>
          <Image
            source={Images.catLaptop}
            style={styles.illustration}
            resizeMode="contain"
          />

          <Text style={styles.subtitle}>Check your email</Text>

          <Text style={styles.description}>
            We've sent a login code to{' '}
            <Text style={styles.emailText}>{email}</Text>.{'\n'}
            Please enter the 4-digit code sent in the email.
          </Text>

          <OTPInput
            length={4}
            onComplete={handleOTPComplete}
            error={otpError}
            autoFocus
          />
        </View>
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <LiquidGlassButton
          title="Verify code"
          onPress={handleVerifyCode}
          style={styles.verifyButton}
          textStyle={styles.verifyButtonText}
          tintColor={theme.colors.secondary}
          height={56}
          borderRadius={16}
        />

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Haven't got the OTP yet? </Text>
          {canResend ? (
            <TouchableOpacity onPress={handleResendOTP}>
              <Text style={styles.resendLink}>Resend</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.countdownText}>
              00:{countdown.toString().padStart(2, '0')} sec
            </Text>
          )}
        </View>
      </View>
 <View style={styles.bottomSheetContainer}>
      {/* Success Bottom Sheet */}
      <CustomBottomSheet
        ref={successBottomSheetRef}
        snapPoints={['45%']}
        initialIndex={-1}
        enablePanDownToClose={false}
        enableBackdrop={true}
        backdropOpacity={0.5}
        backdropAppearsOnIndex={0}
        backdropDisappearsOnIndex={-1}
        backdropPressBehavior="none"
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        {renderSuccessContent()}
      </CustomBottomSheet>
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
      paddingTop: 100, // Account for fixed header
      paddingHorizontal: 20,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 20,
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginBottom: 40,
      textAlign: 'center',
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
      color: theme.colors.textSecondary,
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
    },
    resendText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    resendLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
    countdownText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    },
     // Bottom Sheet Container Styles
    bottomSheetContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      elevation: 9999,
      pointerEvents: 'box-none', // Allow touches to pass through when sheet is closed
    },
    // Bottom Sheet Styles
    bottomSheetBackground: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.black,
      width: 80,
      height: 6,
      opacity: 0.2,
    },
    successContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    successIllustration: {
      height: 170,
      marginBottom: 24,
    },
    successTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
      textAlign: 'center',
    },
    successMessage: {
      ...theme.typography.paragraph,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    successEmailText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    successButton: {
      width: '100%',
    },
    successButtonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });