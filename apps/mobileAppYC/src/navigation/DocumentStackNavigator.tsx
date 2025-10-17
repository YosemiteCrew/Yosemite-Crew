import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {DocumentStackParamList} from './types';

// Import screens (will be created)
import {DocumentsScreen} from '@/screens/documents/DocumentsScreen/DocumentsScreen';
import {AddDocumentScreen} from '@/screens/documents/AddDocumentScreen/AddDocumentScreen';
import {EditDocumentScreen} from '@/screens/documents/EditDocumentScreen/EditDocumentScreen';
import {DocumentPreviewScreen} from '@/screens/documents/DocumentPreviewScreen/DocumentPreviewScreen';
import {CategoryDetailScreen} from '@/screens/documents/CategoryDetailScreen/CategoryDetailScreen';
import {SubcategoryDetailScreen} from '@/screens/documents/SubcategoryDetailScreen/SubcategoryDetailScreen';

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
      <Stack.Screen name="SubcategoryDetail" component={SubcategoryDetailScreen} />
    </Stack.Navigator>
  );
};
