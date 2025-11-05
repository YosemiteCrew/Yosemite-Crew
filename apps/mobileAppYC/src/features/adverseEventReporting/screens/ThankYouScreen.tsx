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
  const [agreeToBeContacted, setAgreeToBeContacted] = useState(true);

  const handleBack = () => {
    navigation.getParent<any>()?.navigate('HomeStack');
  };

  const handleSendToManufacturer = () => {
    console.log('[ThankYou] Send to manufacturer');
    // Mock API call
    handleBack();
  };

  const handleSendToHospital = () => {
    console.log('[ThankYou] Send to hospital');
    // Mock API call
    handleBack();
  };

  const handleCallAuthority = () => {
    console.log('[ThankYou] Call authority');
    // Mock API call
    handleBack();
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
        <Image source={Images.catEmergency} style={styles.heroImage} />

        <Text style={styles.title}>Thank you for reaching out to us</Text>
        <Text style={styles.subtitle}>
          By submitting a report, you agree to be contacted by the company if needed to obtain
          further details regarding your report.
        </Text>

        <View style={styles.checkboxSection}>
          <Checkbox
            value={agreeToBeContacted}
            onValueChange={setAgreeToBeContacted}
            label="I agree to be contacted"
          />
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
      width: 160,
      height: 160,
      resizeMode: 'contain',
      alignSelf: 'center',
      marginBottom: theme.spacing[6],
    },
    title: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing[3],
      lineHeight: 28,
    },
    subtitle: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing[6],
      lineHeight: 22,
    },
    checkboxSection: {
      marginBottom: theme.spacing[6],
    },
    actionsContainer: {
      gap: theme.spacing[4],
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
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
      textAlign: 'center',
    },
    lightButton: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderMuted,
    },
    lightButtonText: {
      color: theme.colors.secondary,
      ...theme.typography.paragraphBold,
      textAlign: 'center',
    },
    phoneAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing[4],
      gap: theme.spacing[3],
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderMuted,
      marginTop: theme.spacing[4],
    },
    phoneIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.primary,
    },
    phoneText: {
      ...theme.typography.labelMdBold,
      color: theme.colors.primary,
    },
  });
