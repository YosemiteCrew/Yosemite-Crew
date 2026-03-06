import {useCallback} from 'react';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {DocumentStackParamList} from '@/navigation/types';

type DocumentsNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;

export const useDocumentNavigation = (navigation: DocumentsNavigationProp) => {
  const handleAddDocument = useCallback(() => {
    navigation.navigate('AddDocument');
  }, [navigation]);

  const handleViewDocument = useCallback(
    (documentId: string) => {
      navigation.navigate('DocumentPreview', {documentId});
    },
    [navigation],
  );

  const handleEditDocument = useCallback(
    (documentId: string) => {
      navigation.navigate('EditDocument', {documentId});
    },
    [navigation],
  );

  return {
    handleAddDocument,
    handleViewDocument,
    handleEditDocument,
  };
};
