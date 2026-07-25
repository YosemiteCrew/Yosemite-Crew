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
import {TasksMainScreen} from '@/features/tasks/screens/TasksMainScreen/TasksMainScreen';
import {AppointmentsScreen} from '@/features/appointments/screens/AppointmentsScreen';
import {DocumentsScreen} from '@/features/documents/screens/DocumentsScreen';

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
jest.mock(
  '@/features/documents/screens/EmptyDocumentsScreen/EmptyDocumentsScreen',
  () => {
    const ReactModule = require('react');
    const {View, Text} = require('react-native');
    return {
      EmptyDocumentsScreen: () =>
        ReactModule.createElement(
          View,
          {},
          ReactModule.createElement(Text, {}, 'Empty Documents'),
        ),
    };
  },
);

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

  // These trees used to be created and left mounted. React 19 keeps scheduler
  // work queued for an un-unmounted tree, and from Jest 30 that callback firing
  // after the environment is torn down fails whichever suite the worker picks
  // up next ("trying to `require` a file after the Jest environment has been
  // torn down"). Unmounting inside act drains that work here instead. The tree
  // is serialised before the act so these remain first-render snapshots.
  const renderSnapshot = (ui: React.ReactElement) => {
    const tree = renderer.create(ui);
    const json = tree.toJSON();
    renderer.act(() => {
      tree.unmount();
    });
    return json;
  };

  describe('TasksMainScreen', () => {
    it('should render correctly', () => {
      const tree = renderSnapshot(
        <Provider store={store}>
          <TasksMainScreen />
        </Provider>,
      );
      expect(tree).toMatchSnapshot();
    });
  });

  describe('AppointmentsScreen', () => {
    it('should render correctly', () => {
      const tree = renderSnapshot(
        <Provider store={store}>
          <AppointmentsScreen />
        </Provider>,
      );
      expect(tree).toMatchSnapshot();
    });
  });

  describe('DocumentsScreen', () => {
    it('should render correctly', () => {
      const tree = renderSnapshot(
        <Provider store={store}>
          <DocumentsScreen />
        </Provider>,
      );
      expect(tree).toMatchSnapshot();
    });
  });
});
