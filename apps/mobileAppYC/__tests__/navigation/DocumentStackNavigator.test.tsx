import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {render, waitFor} from '@testing-library/react-native';
import {DocumentStackNavigator} from '@/navigation/DocumentStackNavigator';

// --- Mocks ---

// 1. Navigation Mocks
// FIX: Use require('react-native') inside the factory to prevent hoisting reference errors
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}: any) => {
      const {View} = require('react-native');
      return <View testID="MockNavigator">{children}</View>;
    },
    Screen: ({name}: any) => {
      const {View} = require('react-native');
      return <View testID={`Screen-${name}`} />;
    },
  }),
}));

// 2. Screen Component Mocks
// We mock these to avoid rendering complex children and their dependencies
// FIX: Use require('react-native') inside factories here as well for consistency/safety
jest.mock(
  '@/features/documents/screens/DocumentsScreen/DocumentsScreen',
  () => ({
    DocumentsScreen: () => {
      const {View} = require('react-native');
      return <View />;
    },
  }),
);
jest.mock(
  '@/features/documents/screens/AddDocumentScreen/AddDocumentScreen',
  () => ({
    AddDocumentScreen: () => {
      const {View} = require('react-native');
      return <View />;
    },
  }),
);
jest.mock(
  '@/features/documents/screens/EditDocumentScreen/EditDocumentScreen',
  () => ({
    EditDocumentScreen: () => {
      const {View} = require('react-native');
      return <View />;
    },
  }),
);
jest.mock(
  '@/features/documents/screens/DocumentPreviewScreen/DocumentPreviewScreen',
  () => ({
    DocumentPreviewScreen: () => {
      const {View} = require('react-native');
      return <View />;
    },
  }),
);
jest.mock(
  '@/features/documents/screens/CategoryDetailScreen/CategoryDetailScreen',
  () => ({
    CategoryDetailScreen: () => {
      const {View} = require('react-native');
      return <View />;
    },
  }),
);
jest.mock(
  '@/features/documents/screens/DocumentSearchScreen/DocumentSearchScreen',
  () => ({
    DocumentSearchScreen: () => {
      const {View} = require('react-native');
      return <View />;
    },
  }),
);

// --- Tests ---

describe('DocumentStackNavigator', () => {
  const renderNavigator = () => {
    return render(
      <NavigationContainer>
        <DocumentStackNavigator />
      </NavigationContainer>,
    );
  };

  it('renders the navigator container', async () => {
    const {getByTestId} = renderNavigator();

    // Wait for navigation container to mount
    await waitFor(() => {
      expect(getByTestId('MockNavigator')).toBeTruthy();
    });
  });

  it('defines all required screens in the stack', async () => {
    const {getByTestId} = renderNavigator();

    await waitFor(() => {
      // Check that all route names are registered in the stack
      expect(getByTestId('Screen-DocumentsMain')).toBeTruthy();
      expect(getByTestId('Screen-AddDocument')).toBeTruthy();
      expect(getByTestId('Screen-EditDocument')).toBeTruthy();
      expect(getByTestId('Screen-DocumentPreview')).toBeTruthy();
      expect(getByTestId('Screen-CategoryDetail')).toBeTruthy();
      expect(getByTestId('Screen-DocumentSearch')).toBeTruthy();
    });
  });
});
