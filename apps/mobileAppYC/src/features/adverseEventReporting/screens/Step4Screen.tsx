import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import { LiquidGlassCard } from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import { Separator, RowButton } from '@/shared/components/common/FormRowComponents';
import { Images } from '@/assets/images';
import { capitalize } from '@/shared/utils/commonHelpers';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step4'>;

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
      <AERLayout stepLabel="Step 4 of 5" onBack={() => navigation.goBack()}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Companion not found</Text>
        </View>
      </AERLayout>
    );
  }

  return (
    <AERLayout
      stepLabel="Step 4 of 5"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Next', onPress: () => navigation.navigate('Step5') }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Companion Information</Text>
        <TouchableOpacity onPress={handleEdit}>
          <Image source={Images.blackEdit} style={styles.editIcon} />
        </TouchableOpacity>
      </View>

      <LiquidGlassCard
        glassEffect="clear"
        interactive
        style={styles.infoCard}
        fallbackStyle={styles.infoCardFallback}
      >
        <View style={styles.cardContent}>
          <RowButton
            label="Name"
            value={selectedCompanion.name}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Breed"
            value={selectedCompanion.breed?.breedName ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Date of birth"
            value={
              selectedCompanion.dateOfBirth
                ? new Date(selectedCompanion.dateOfBirth).toLocaleDateString()
                : ''
            }
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Gender"
            value={capitalize(selectedCompanion.gender ?? '')}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Current weight"
            value={selectedCompanion.currentWeight ? `${selectedCompanion.currentWeight} kg` : ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Color"
            value={selectedCompanion.color ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Allergies"
            value={selectedCompanion.allergies ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Neutered status"
            value={capitalize(selectedCompanion.neuteredStatus ?? '')}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Blood group"
            value={selectedCompanion.bloodGroup ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Microchip number"
            value={selectedCompanion.microchipNumber ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Passport number"
            value={selectedCompanion.passportNumber ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Insurance status"
            value={capitalize(selectedCompanion.insuredStatus ?? '')}
            onPress={handleEdit}
          />
        </View>
      </LiquidGlassCard>
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing[4],
    },
    sectionTitle: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      marginHorizontal: theme.spacing[2],
    },
    infoCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      marginBottom: theme.spacing[6],
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    infoCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
    },
    cardContent: {
      paddingVertical: 0,
    },
    editIcon: {
      width: 20,
      height: 20,
      marginHorizontal: theme.spacing[2],
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
  });
