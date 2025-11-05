import React, { useState, useMemo } from 'react';
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
import type { RootState } from '@/app/store';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step1'>;

export const Step1Screen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const companions = useSelector((state: RootState) => state.companion.companions);

  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null);
  const [reporterType, setReporterType] = useState<'parent' | 'guardian'>('parent');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

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
            <View style={[styles.radio, reporterType === 'parent' && styles.radioSelected]} />
            <Text style={styles.radioLabel}>The parent</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setReporterType('guardian')}
          >
            <View style={[styles.radio, reporterType === 'guardian' && styles.radioSelected]} />
            <Text style={styles.radioLabel}>The guardian (Co-Parent)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.checkboxSection}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreeToTerms(!agreeToTerms)}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              I agree to Yosemite Crew's terms and conditions and privacy policy
            </Text>
          </TouchableOpacity>
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
    },
    heroImage: {
      width: '100%',
      height: 150,
      resizeMode: 'contain',
      marginBottom: theme.spacing[6],
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
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.borderMuted,
      marginRight: theme.spacing[3],
    },
    radioSelected: {
      borderColor: theme.colors.primary,
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
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.colors.borderMuted,
      marginRight: theme.spacing[2],
      marginTop: theme.spacing[1],
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    checkmark: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: 'bold',
    },
    checkboxLabel: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.secondary,
      flex: 1,
      lineHeight: 22,
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
