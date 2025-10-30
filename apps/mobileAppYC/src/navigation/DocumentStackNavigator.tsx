import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {DocumentStackParamList} from './types';

// Import screens (will be created)
import {DocumentsScreen} from '@/features/documents/screens/DocumentsScreen/DocumentsScreen';
import {AddDocumentScreen} from '@/features/documents/screens/AddDocumentScreen/AddDocumentScreen';
import {EditDocumentScreen} from '@/features/documents/screens/EditDocumentScreen/EditDocumentScreen';
import {DocumentPreviewScreen} from '@/features/documents/screens/DocumentPreviewScreen/DocumentPreviewScreen';
import {CategoryDetailScreen} from '@/features/documents/screens/CategoryDetailScreen/CategoryDetailScreen';

const Stack = createNativeStackNavigator<DocumentStackParamList>();

export const DocumentStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="DocumentsMain" component={DocumentsScreen} />
      <Stack.Screen name="AddDocument" component={AddDocumentScreen} />
      <Stack.Screen name="EditDocument" component={EditDocumentScreen} />
      <Stack.Screen name="DocumentPreview" component={DocumentPreviewScreen} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
    </Stack.Navigator>
  );
};
