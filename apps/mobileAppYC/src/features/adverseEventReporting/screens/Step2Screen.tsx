import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import AERInfoSection from '@/features/adverseEventReporting/components/AERInfoSection';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step2'>;

export const Step2Screen: React.FC<Props> = ({ navigation }) => {
  const authUser = useSelector((state: RootState) => state.auth.user);

  const handleEdit = () => {
    navigation.getParent<any>()?.navigate('HomeStack', {
      screen: 'EditParentOverview',
      params: { companionId: 'parent' },
    });
  };

  return (
    <AERLayout
      stepLabel="Step 2 of 5"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Next', onPress: () => navigation.navigate('Step3') }}
    >
      <AERInfoSection
        title="Parent Information"
        onEdit={handleEdit}
        rows={[
          {label: 'First name', value: authUser?.firstName ?? '', onPress: handleEdit},
          {label: 'Last name', value: authUser?.lastName ?? '', onPress: handleEdit},
          {label: 'Phone number', value: authUser?.phone ?? '', onPress: handleEdit},
          {label: 'Email address', value: authUser?.email ?? '', onPress: handleEdit},
          {label: 'Currency', value: authUser?.currency ?? 'USD', onPress: handleEdit},
          {
            label: 'Date of birth',
            value: authUser?.dateOfBirth
              ? new Date(authUser.dateOfBirth).toLocaleDateString('en-US', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '',
            onPress: handleEdit,
          },
          {label: 'Address', value: authUser?.address?.addressLine ?? '', onPress: handleEdit},
          {label: 'City', value: authUser?.address?.city ?? '', onPress: handleEdit},
          {label: 'State/Province', value: authUser?.address?.stateProvince ?? '', onPress: handleEdit},
          {label: 'Postal code', value: authUser?.address?.postalCode ?? '', onPress: handleEdit},
          {label: 'Country', value: authUser?.address?.country ?? '', onPress: handleEdit},
        ]}
      />
    </AERLayout>
  );
};
