import React, {useMemo} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import {capitalize} from '@/shared/utils/commonHelpers';
import type {AdverseEventStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step4'>;

export const Step4Screen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const selectedCompanion = useSelector((state: RootState) =>
    state.companion.selectedCompanionId
      ? state.companion.companions.find(
          c => c.id === state.companion.selectedCompanionId,
        )
      : null,
  );

  const handleEdit = () => {
    if (selectedCompanion) {
      navigation.getParent<any>()?.navigate('HomeStack', {
        screen: 'EditCompanionOverview',
        params: {companionId: selectedCompanion.id},
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

  const summaryRows = [
    {label: 'Name', value: selectedCompanion.name},
    {label: 'Breed', value: selectedCompanion.breed?.breedName ?? ''},
    {
      label: 'Date of birth',
      value: selectedCompanion.dateOfBirth
        ? new Date(selectedCompanion.dateOfBirth).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '',
    },
    {label: 'Gender', value: capitalize(selectedCompanion.gender ?? '')},
    {
      label: 'Current weight',
      value: selectedCompanion.currentWeight
        ? `${selectedCompanion.currentWeight} kg`
        : '',
    },
    {label: 'Color', value: selectedCompanion.color ?? ''},
    {label: 'Allergies', value: selectedCompanion.allergies ?? ''},
    {
      label: 'Neutered status',
      value: capitalize(selectedCompanion.neuteredStatus ?? ''),
    },
    {label: 'Blood group', value: selectedCompanion.bloodGroup ?? ''},
    {label: 'Microchip number', value: selectedCompanion.microchipNumber ?? ''},
    {label: 'Passport number', value: selectedCompanion.passportNumber ?? ''},
    {
      label: 'Insurance status',
      value: capitalize(selectedCompanion.insuredStatus ?? ''),
    },
  ];

  return (
    <AERLayout
      stepLabel="Step 4 of 5"
      currentStep={4}
      totalSteps={5}
      onBack={() => navigation.goBack()}
      bottomButton={{
        title: 'Next',
        onPress: () => navigation.navigate('Step5'),
      }}>
      <Text
        style={
          styles.title
        }>{`About ${selectedCompanion.name} at the time`}</Text>
      <Text style={styles.subtitle}>
        From their record. Correct anything that was different when the event
        happened.
      </Text>

      <View style={styles.summaryCard}>
        {summaryRows.map((row, idx) => (
          <React.Fragment key={row.label}>
            <PressableOpacity
              testID={`aer-summary-row-${idx}`}
              style={styles.summaryRow}
              activeOpacity={0.8}
              accessibilityRole="button"
              onPress={handleEdit}>
              <Text style={styles.summaryLabel}>{row.label}</Text>
              <Text
                style={styles.summaryValue}
                numberOfLines={1}
                ellipsizeMode="tail">
                {row.value && row.value.trim().length > 0 ? row.value : '—'}
              </Text>
            </PressableOpacity>
            {idx < summaryRows.length - 1 ? (
              <View style={styles.divider} />
            ) : null}
          </React.Fragment>
        ))}
      </View>
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
      ...theme.typography.emptyStateTitle,
      color: theme.colors.inkMuted,
      textAlign: 'center',
    },
    title: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
      marginBottom: theme.spacing['2'],
    },
    subtitle: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.inkMuted,
      marginBottom: theme.spacing['6'],
    },
    summaryCard: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.cardSmall,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['1'],
      marginBottom: theme.spacing['6'],
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['3'],
    },
    summaryLabel: {
      ...theme.typography.body13,
      color: theme.colors.inkMuted,
      flex: 1,
    },
    summaryValue: {
      ...theme.typography.bodySmallBold,
      color: theme.colors.inkBody,
      flex: 1,
      textAlign: 'right',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.hairline,
    },
  });
