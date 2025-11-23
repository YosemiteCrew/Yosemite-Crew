import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import { Images } from '@/assets/images';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import { CompanionSelector } from '@/shared/components/common/CompanionSelector/CompanionSelector';
import { Checkbox } from '@/shared/components/common/Checkbox/Checkbox';
import type { RootState } from '@/app/store';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step1'>;

export const Step1Screen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const companions = useSelector((state: RootState) => state.companion.companions);
  const globalSelectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);

  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null);
  const [reporterType, setReporterType] = useState<'parent' | 'guardian'>('parent');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [termsError, setTermsError] = useState('');

  // Set the globally selected companion as default when component mounts
  useEffect(() => {
    if (globalSelectedCompanionId && !selectedCompanionId) {
      setSelectedCompanionId(globalSelectedCompanionId);
    }
  }, [globalSelectedCompanionId, selectedCompanionId]);

  const handleNext = () => {
    if (!selectedCompanionId) {
      return;
    }

    if (!agreeToTerms) {
      setTermsError('Accept the terms to continue');
      return;
    }
    navigation.navigate('Step2');
  };

  const isCompanionSelected = !!selectedCompanionId;
  const handleToggleTerms = () => {
    setAgreeToTerms(prev => {
      const nextValue = !prev;
      if (nextValue && termsError) {
        setTermsError('');
      }
      return nextValue;
    });
  };

  return (
    <AERLayout
      stepLabel="Step 1 of 5"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Next', onPress: handleNext, disabled: !isCompanionSelected }}
    >
      <Image source={Images.adverse2} style={styles.heroImage} />

      <Text style={styles.title}>Veterinary product adverse events</Text>
      <Text style={styles.subtitle}>Notify the manufacturer about any issues or concerns you experienced with a pharmaceutical product used for your pet.</Text>

      <Text style={styles.descriptionText}>To report a potential side effect, unexpected reaction, or any other concern following the use of a YosemiteCrew Animal Health product, please fill out the following form as completely and accurately as possible.</Text>

      <View style={styles.companionSelector}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={setSelectedCompanionId}
          showAddButton={false}
          requiredPermission="emergencyBasedPermissions"
          permissionLabel="emergency actions"
        />
      </View>

      <View style={styles.radioSection}>
        <Text style={styles.sectionTitle}>Who is reporting the concern?</Text>

        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => setReporterType('parent')}
        >
          <View style={styles.radioOuter}>
            {reporterType === 'parent' && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.radioLabel}>The parent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => setReporterType('guardian')}
        >
          <View style={styles.radioOuter}>
            {reporterType === 'guardian' && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.radioLabel}>The guardian (Co-Parent)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.checkboxSection}>
        <Text style={styles.beforeProceed}>Before you proceed</Text>
        <TouchableOpacity
          style={styles.consentRow}
          activeOpacity={0.9}
          onPress={handleToggleTerms}
          accessibilityRole="checkbox"
          accessibilityState={{checked: agreeToTerms}}
        >
          <Checkbox
            value={agreeToTerms}
            onValueChange={() => {
              handleToggleTerms();
            }}
          />
          <Text style={styles.consentText}>
            I agree to Yosemite Crew’s <Text style={styles.consentLink}>terms and conditions</Text> and <Text style={styles.consentLink}>privacy policy</Text>
          </Text>
        </TouchableOpacity>
        {termsError ? <Text style={styles.errorText}>{termsError}</Text> : null}
      </View>
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    heroImage: {
      width: '100%',
      height: 200,
      resizeMode: 'contain',
      marginBottom: theme.spacing[6],
    },
    title: {
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
      textAlign: 'center',
            paddingHorizontal: theme.spacing[16],
    },
    subtitle: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.placeholder,
      marginBottom: theme.spacing[6],
      textAlign: 'center',
      paddingHorizontal: theme.spacing[6],
    },
    descriptionText: {
      ...theme.typography.businessTitle16,
      color: theme.colors.text,
      marginBottom: theme.spacing[6],

    },
    companionSelector: {
      marginBottom: theme.spacing[6],
    },
    radioSection: {
      marginBottom: theme.spacing[6],
    },
    sectionTitle: {
      ...theme.typography.businessTitle16,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[3],
    },
    radioOption: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing[4],
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.borderMuted,
      marginRight: theme.spacing[3],
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    radioLabel: {
      ...theme.typography.body,
      color: theme.colors.secondary,

    },
    checkboxSection: {
      marginBottom: theme.spacing[6],
      gap: theme.spacing[2],
      // Ensure long consent text doesn't touch screen edge
      paddingRight: theme.spacing[8],
    },
    beforeProceed: {
      // Satoshi 15 bold, 120%, -0.3 letter spacing
      ...theme.typography.pillSubtitleBold15,
      lineHeight: 18,
      color: theme.colors.secondary,
        marginBottom: theme.spacing[2],
    },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      // Keep checkbox and text on the same row; allow text to wrap
      flexWrap: 'nowrap',
      width: '100%',
    },
    consentText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      marginLeft: 8,
      flex: 1,
      // Add comfortable space from the right screen edge
      paddingRight: theme.spacing[6],
    },
    consentLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textTertiary,
    },
    errorText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
      marginLeft: theme.spacing[1],
    },
  });
