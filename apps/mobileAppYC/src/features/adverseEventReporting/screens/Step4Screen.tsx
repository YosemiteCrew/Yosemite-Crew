import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import AERInfoSection from '@/features/adverseEventReporting/components/AERInfoSection';
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
      <AERInfoSection
        title="Companion Information"
        onEdit={handleEdit}
        rows={[
          {label: 'Name', value: selectedCompanion.name, onPress: handleEdit},
          {label: 'Breed', value: selectedCompanion.breed?.breedName ?? '', onPress: handleEdit},
          {
            label: 'Date of birth',
            value: selectedCompanion.dateOfBirth
              ? new Date(selectedCompanion.dateOfBirth).toLocaleDateString('en-US', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '',
            onPress: handleEdit,
          },
          {label: 'Gender', value: capitalize(selectedCompanion.gender ?? ''), onPress: handleEdit},
          {
            label: 'Current weight',
            value: selectedCompanion.currentWeight ? `${selectedCompanion.currentWeight} kg` : '',
            onPress: handleEdit,
          },
          {label: 'Color', value: selectedCompanion.color ?? '', onPress: handleEdit},
          {label: 'Allergies', value: selectedCompanion.allergies ?? '', onPress: handleEdit},
          {label: 'Neutered status', value: capitalize(selectedCompanion.neuteredStatus ?? ''), onPress: handleEdit},
          {label: 'Blood group', value: selectedCompanion.bloodGroup ?? '', onPress: handleEdit},
          {label: 'Microchip number', value: selectedCompanion.microchipNumber ?? '', onPress: handleEdit},
          {label: 'Passport number', value: selectedCompanion.passportNumber ?? '', onPress: handleEdit},
          {label: 'Insurance status', value: capitalize(selectedCompanion.insuredStatus ?? ''), onPress: handleEdit},
        ]}
      />
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
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
