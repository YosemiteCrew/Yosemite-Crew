import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { Images } from '@/assets/images';
import { SafeArea } from '@/shared/components/common';
import { Header } from '@/shared/components/common/Header/Header';
import { Checkbox } from '@/shared/components/common/Checkbox/Checkbox';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'ThankYou'>;

export const ThankYouScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [agreeToBeContacted, setAgreeToBeContacted] = useState(false);
  const [contactError, setContactError] = useState('');

  const handleBack = () => {
    // Reset the AdverseEvent stack and navigate back to Home
    // This pops all screens from the AdverseEvent stack and goes back to Home
    navigation.navigate('Home' as never);
  };

  const requireContactConsent = (action: () => void) => {
    if (!agreeToBeContacted) {
      setContactError('Select the checkbox to continue');
      return;
    }
    if (contactError) {
      setContactError('');
    }
    action();
  };

  const handleSendToManufacturer = () => {
    requireContactConsent(() => {
      console.log('[ThankYou] Send to manufacturer');
      handleBack();
    });
  };

  const handleSendToHospital = () => {
    requireContactConsent(() => {
      console.log('[ThankYou] Send to hospital');
      handleBack();
    });
  };

  const handleCallAuthority = () => {
    requireContactConsent(() => {
      console.log('[ThankYou] Call authority');
      handleBack();
    });
  };

  return (
    <SafeArea>
      <Header
        title="Adverse event reporting"
        showBackButton
        onBack={handleBack}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={Images.adverse3} style={styles.heroImage} />

        <Text style={styles.title}>Thank you for reaching out to us</Text>
        <Text style={styles.subtitle}>
          By submitting a report, you agree to be contacted by the company if needed to obtain
          further details regarding your report.
        </Text>

        <View style={styles.checkboxSection}>
          <Checkbox
            value={agreeToBeContacted}
            onValueChange={value => {
              setAgreeToBeContacted(value);
              if (value && contactError) {
                setContactError('');
              }
            }}
            label="I agree to be contacted by Drug Manufacturer, Hospital, or Regulatory Authority if needed."
            labelStyle={styles.checkboxLabel}
          />
          {contactError ? <Text style={styles.errorText}>{contactError}</Text> : null}
        </View>

        <View style={styles.actionsContainer}>
          <LiquidGlassButton
            title="Send report to drug manufacturer"
            onPress={handleSendToManufacturer}
            glassEffect="clear"
            interactive
            borderRadius="lg"
            forceBorder
            borderColor={theme.colors.borderMuted}
            height={56}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
          />

          <LiquidGlassButton
            title="Send report to hospital"
            onPress={handleSendToHospital}
            glassEffect="clear"
            interactive
            borderRadius="lg"
            forceBorder
            borderColor={theme.colors.borderMuted}
            height={56}
            style={[styles.button, styles.lightButton]}
            textStyle={styles.lightButtonText}
            tintColor={theme.colors.white}
            shadowIntensity="light"
          />

          <TouchableOpacity
            style={styles.phoneAction}
            onPress={handleCallAuthority}
          >
            <Image source={Images.phone} style={styles.phoneIcon} />
            <Text style={styles.phoneText}>Call regulatory authority</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[6],
      paddingBottom: theme.spacing[24],
    },
    heroImage: {
      width: 220,
      height: 220,
      resizeMode: 'contain',
      alignSelf: 'center',
      marginBottom: theme.spacing[2],
    },
    title: {
      // Clash Grotesk 20/24, 500, -0.2
      ...theme.typography.businessSectionTitle20,
      color: '#302F2E',
      marginBottom: theme.spacing[3],
      alignSelf: 'center',
    },
    subtitle: {
      // Satoshi 15 Bold, 120%
      ...theme.typography.pillSubtitleBold15,
      color: '#302F2E',
      marginBottom: theme.spacing[6],
      lineHeight: 18,
      letterSpacing: -0.3,
    },
    checkboxSection: {
      // Increased space before buttons group
      marginBottom: theme.spacing[8],
    },
    checkboxLabel: {
      // Satoshi 15 Bold, 120%
      ...theme.typography.pillSubtitleBold15,
      color: '#302F2E',
      lineHeight: 18,
      letterSpacing: -0.3,
    },
    errorText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
      marginTop: theme.spacing[2],
      marginLeft: theme.spacing[1],
    },
    actionsContainer: {
      // Slightly larger gap between buttons
      gap: theme.spacing[5],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonText: {
      // CTA Clash Grotesk 18/18, 500, -0.18, white
      ...theme.typography.h6Clash,
      color: '#FFFEFE',
      lineHeight: 18,
      letterSpacing: -0.18,
      textAlign: 'center',
    },
    lightButton: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderMuted,
    },
    lightButtonText: {
      // CTA Clash Grotesk 18/18, 500, -0.18, Jet-500
      ...theme.typography.h6Clash,
      color: '#302F2E',
      lineHeight: 18,
      letterSpacing: -0.18,
      textAlign: 'center',
    },
    phoneAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing[8],
      gap: theme.spacing[3],
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderMuted,
      marginTop: theme.spacing[2],
    },
    phoneIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
    },
    phoneText: {
      // CTA Clash Grotesk 18/18, 500, -0.18, Jet-500
      ...theme.typography.h6Clash,
      color: '#302F2E',
      lineHeight: 18,
      letterSpacing: -0.18,
      textAlign: 'center',
    },
  });
