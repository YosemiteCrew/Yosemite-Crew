import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import { SafeArea } from '@/shared/components/common';
import { Header } from '@/shared/components/common/Header/Header';
import { LiquidGlassCard } from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import { Images } from '@/assets/images';
import { capitalize } from '@/shared/utils/commonHelpers';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step4'>;

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing[3] }}>
      <Text style={{ ...theme.typography.labelSmall, color: theme.colors.textSecondary }}>
        {label}
      </Text>
      <Text style={{ ...theme.typography.body, color: theme.colors.secondary }}>
        {value || '—'}
      </Text>
    </View>
  );
};

export const Step4Screen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const selectedCompanion = useSelector(
    (state: RootState) => state.companion.selectedCompanionId
      ? state.companion.companions.find(c => c.id === state.companion.selectedCompanionId)
      : null
  );

  const handleEdit = () => {
    if (selectedCompanion) {
      navigation.getParent<any>()?.navigate('HomeStack', {
        screen: 'EditCompanionOverview',
        params: { companionId: selectedCompanion.id },
      });
    }
  };

  if (!selectedCompanion) {
    return (
      <SafeArea>
        <Header title="Adverse event reporting" showBackButton onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Companion not found</Text>
        </View>
      </SafeArea>
    );
  }

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
        <Text style={styles.stepTitle}>Step 4 of 5</Text>

        <LiquidGlassCard
          glassEffect="clear"
          interactive
          style={styles.infoCard}
          fallbackStyle={styles.infoCardFallback}
        >
          <View style={styles.cardContent}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>Companion Information</Text>
              <TouchableOpacity onPress={handleEdit}>
                <Image source={Images.blackEdit} style={styles.editIcon} />
              </TouchableOpacity>
            </View>

            <InfoRow label="Name" value={selectedCompanion.name} />
            <InfoRow label="Breed" value={selectedCompanion.breed?.breedName ?? ''} />
            <InfoRow
              label="Date of birth"
              value={
                selectedCompanion.dateOfBirth
                  ? new Date(selectedCompanion.dateOfBirth).toLocaleDateString()
                  : ''
              }
            />
            <InfoRow label="Gender" value={capitalize(selectedCompanion.gender ?? '')} />
            <InfoRow
              label="Current weight"
              value={selectedCompanion.currentWeight ? `${selectedCompanion.currentWeight} kg` : ''}
            />
            <InfoRow label="Color" value={selectedCompanion.color ?? ''} />
            <InfoRow label="Allergies" value={selectedCompanion.allergies ?? ''} />
            <InfoRow label="Neutered status" value={capitalize(selectedCompanion.neuteredStatus ?? '')} />
            <InfoRow label="Blood group" value={selectedCompanion.bloodGroup ?? ''} />
            <InfoRow label="Microchip number" value={selectedCompanion.microchipNumber ?? ''} />
            <InfoRow label="Passport number" value={selectedCompanion.passportNumber ?? ''} />
            <InfoRow label="Insurance status" value={capitalize(selectedCompanion.insuredStatus ?? '')} />
          </View>
        </LiquidGlassCard>

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Next"
            onPress={() => navigation.navigate('Step5')}
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
      ...theme.typography.bodySmallTight,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[4],
    },
    infoCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      marginBottom: theme.spacing[6],
    },
    infoCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
    },
    cardContent: {
      padding: theme.spacing[4],
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing[4],
    },
    cardTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    editIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    buttonContainer: {
      marginTop: theme.spacing[4],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });
