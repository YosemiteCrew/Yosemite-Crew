import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Text,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import { Images } from '@/assets/images';
import { SafeArea } from '@/shared/components/common';
import { Header } from '@/shared/components/common/Header/Header';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
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

  // Set the globally selected companion as default when component mounts
  useEffect(() => {
    if (globalSelectedCompanionId && !selectedCompanionId) {
      setSelectedCompanionId(globalSelectedCompanionId);
    }
  }, [globalSelectedCompanionId, selectedCompanionId]);

  const handleNext = () => {
    if (!selectedCompanionId || !agreeToTerms) {
      return;
    }
    navigation.navigate('Step2');
  };

  const isFormValid = selectedCompanionId && agreeToTerms;

  return (
    <SafeArea>
      <Header
        title="Adverse event reporting"
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Step 1 of 5</Text>
        <Image source={Images.adverse2} style={styles.heroImage} />

        <Text style={styles.title}>Veterinary product adverse events</Text>
        <Text style={styles.subtitle}>Notify the manufacturer about any issues or concerns you experienced with a pharmaceutical product used for your pet.</Text>

        <Text style={styles.descriptionText}>To report a potential side effect, unexpected reaction, or any other concern following the use of a YosemiteCrew Animal Health product, please fill out the following form as completely and accurately as possible.</Text>

        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={setSelectedCompanionId}
          showAddButton={false}
        />

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
          <Checkbox
            value={agreeToTerms}
            onValueChange={setAgreeToTerms}
            label="I agree to Yosemite Crew's terms and conditions and privacy policy"
          />
        </View>

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Next"
            onPress={handleNext}
            disabled={!isFormValid}
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
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[24],
    },
    stepTitle: {
      ...theme.typography.labelMdBold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[2],
      textAlign: 'center',
    },
    heroImage: {
      width: '100%',
      height: 200,
      resizeMode: 'contain',
      marginBottom: theme.spacing[4],
    },
    title: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[4],
      textAlign: 'center',
    },
    descriptionText: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[6],
      lineHeight: 22,
    },
    radioSection: {
      marginVertical: theme.spacing[6],
      marginBottom: theme.spacing[4],
    },
    sectionTitle: {
      ...theme.typography.labelMdBold,
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
      marginVertical: theme.spacing[6],
      marginBottom: theme.spacing[4],
    },
    buttonContainer: {
      marginTop: theme.spacing[4],
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
    },
  });
