import React, {useState, useMemo, useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import {AERBusinessSelectCard} from '@/features/adverseEventReporting/components/AERBusinessSelectCard';
import type {AdverseEventStackParamList} from '@/navigation/types';
import {useAdverseEventReport} from '@/features/adverseEventReporting/state/AdverseEventReportContext';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step3'>;

export const Step3Screen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {draft, updateDraft} = useAdverseEventReport();
  const linkedBusinesses = useSelector(
    (state: RootState) => state.linkedBusinesses.linkedBusinesses,
  );

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    draft.linkedBusinessId,
  );
  const [error, setError] = useState('');

  const handleNext = () => {
    if (!selectedBusinessId) {
      setError('Select a hospital to continue');
      return;
    }

    navigation.navigate('Step4');
  };

  const handleBusinessSelect = useCallback(
    (id: string) => {
      setSelectedBusinessId(id);
      updateDraft({linkedBusinessId: id});
      setError('');
    },
    [updateDraft],
  );

  return (
    <AERLayout
      currentStep={3}
      totalSteps={5}
      onBack={() => navigation.goBack()}
      bottomButton={{
        title: 'Next',
        onPress: handleNext,
      }}>
      <Text style={styles.title}>Select Linked Hospital</Text>

      <View style={styles.list}>
        {linkedBusinesses.map(business => (
          <AERBusinessSelectCard
            key={business.id}
            business={business}
            isSelected={selectedBusinessId === business.id}
            onSelect={handleBusinessSelect}
          />
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    title: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
      marginBottom: theme.spacing['5'],
    },
    list: {
      marginBottom: theme.spacing['2'],
    },
    errorText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.danger,
      marginTop: theme.spacing['1'],
      marginLeft: theme.spacing['1'],
    },
  });
