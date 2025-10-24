// __tests__/screens/PlaceholderScreens.snapshot.test.tsx
import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

// Import reducers
import {authReducer} from '@/features/auth';
import {themeReducer} from '@/features/theme';
import {companionReducer} from '@/features/companion';
import documentReducer from '@/features/documents/documentSlice';
import tasksReducer from '@/features/tasks/taskSlice';

// Import placeholder screens
import {TasksMainScreen} from '@/screens/tasks/TasksMainScreen/TasksMainScreen';
import {AppointmentsScreen} from '@/screens/appointments/AppointmentsScreen';
import {DocumentsScreen} from '@/screens/documents/DocumentsScreen';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
};

const mockRoute = {
  key: 'test',
  name: 'Test',
  params: {},
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: (callback: any) => {
    // Call the callback to simulate focus effect
    callback();
  },
}));

// Mock Safe Area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: any) => children,
  SafeAreaView: ({children}: any) => children,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));

// Mock EmptyDocumentsScreen to avoid complex dependencies
jest.mock('@/screens/documents/EmptyDocumentsScreen/EmptyDocumentsScreen', () => {
  const React = require('react');
  const {View, Text} = require('react-native');
  return {
    EmptyDocumentsScreen: () => React.createElement(View, {}, React.createElement(Text, {}, 'Empty Documents')),
  };
});

const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      theme: themeReducer,
      companion: companionReducer,
      documents: documentReducer,
      tasks: tasksReducer,
    },
  });
};

describe('Placeholder Screens Snapshots', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('TasksMainScreen', () => {
    it('should render correctly', () => {
      const tree = renderer.create(
        <Provider store={store}>
          <TasksMainScreen />
        </Provider>
      ).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });

  describe('AppointmentsScreen', () => {
    it('should render correctly', () => {
      const tree = renderer.create(
        <Provider store={store}>
          <AppointmentsScreen />
        </Provider>
      ).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });

  describe('DocumentsScreen', () => {
    it('should render correctly', () => {
      const tree = renderer.create(
        <Provider store={store}>
          <DocumentsScreen />
        </Provider>
      ).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });
});
