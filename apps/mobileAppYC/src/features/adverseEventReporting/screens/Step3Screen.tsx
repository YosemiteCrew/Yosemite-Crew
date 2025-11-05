import React, {useState, useMemo} from 'react';
import {StyleSheet, Text, FlatList} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import {LinkedBusinessCard} from '@/features/linkedBusinesses/components/LinkedBusinessCard';
import type {AdverseEventStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step3'>;

export const Step3Screen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const linkedBusinesses = useSelector(
    (state: RootState) => state.linkedBusinesses.linkedBusinesses,
  );

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    null,
  );

  const handleNext = () => {
    if (selectedBusinessId) {
      navigation.navigate('Step4');
    }
  };

  return (
    <AERLayout
      stepLabel="Step 3 of 5"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Next', onPress: handleNext, disabled: !selectedBusinessId, textStyleOverride: styles.buttonText }}
    >
      <Text style={styles.title}>Select Linked Hospital</Text>

      <FlatList
        data={linkedBusinesses}
        scrollEnabled={false}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <LinkedBusinessCard
            business={item}
            onPress={() => setSelectedBusinessId(item.id)}
            showActionButtons={false}
            showBorder={selectedBusinessId === item.id}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    title: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[4],
    },
    listContent: {
      marginBottom: theme.spacing[6],
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });
