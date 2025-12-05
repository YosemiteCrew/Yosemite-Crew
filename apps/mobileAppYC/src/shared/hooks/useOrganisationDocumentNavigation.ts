import {useCallback} from 'react';
import {Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {OrganisationDocumentCategory} from '@/features/legal/services/organisationDocumentService';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const useOrganisationDocumentNavigation = ({
  organisationId,
  organisationName,
}: {
  organisationId?: string | null;
  organisationName?: string | null;
}) => {
  const navigation = useNavigation<Nav>();

  const openDocument = useCallback(
    (category: OrganisationDocumentCategory) => {
      if (!organisationId) {
        Alert.alert(
          'Unavailable',
          'We could not find this business right now. Please try again.',
        );
        return;
      }

      navigation.navigate('OrganisationDocument', {
        organisationId,
        organisationName: organisationName ?? undefined,
        category,
      });
    },
    [navigation, organisationId, organisationName],
  );

  return {
    openTerms: () => openDocument('TERMS_AND_CONDITIONS'),
    openPrivacy: () => openDocument('PRIVACY_POLICY'),
    openCancellation: () => openDocument('CANCELLATION_POLICY'),
  };
};
