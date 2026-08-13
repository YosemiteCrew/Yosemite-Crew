// __tests__/screens/EmptyScreens.snapshot.test.tsx
import React from 'react';
import {cleanupSnapshotTrees, renderSnapshot} from '../setup/snapshotRenderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

import {themeReducer} from '@/features/theme';
import {GenericEmptyScreen} from '@/shared/components/common/GenericEmptyScreen/GenericEmptyScreen';
import {EmptyDocumentsScreen} from '@/features/documents/screens/EmptyDocumentsScreen/EmptyDocumentsScreen';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

// These screens use useTheme, which reads state.theme and dispatches on mount,
// so they must render under a redux Provider. Without one, useAppDispatch throws
// and (because render is not wrapped in act) the error is deferred and leaks out
// asynchronously after the Jest environment tears down.
const createTestStore = () =>
  configureStore({
    reducer: {
      theme: themeReducer,
    },
  });

describe('Empty Screen Snapshots', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  // Unmount in afterEach rather than after the assertion, so a failing
  // snapshot cannot leave a tree mounted and leak into the next suite.
  afterEach(cleanupSnapshotTrees);

  describe('GenericEmptyScreen', () => {
    it('should render with minimal props', () => {
      const tree = renderSnapshot(
        <Provider store={store}>
          <GenericEmptyScreen title="Empty" subtitle="No items found" />
        </Provider>,
      );
      expect(tree).toMatchSnapshot();
    });

    it('should render with all props', () => {
      const tree = renderSnapshot(
        <Provider store={store}>
          <GenericEmptyScreen
            title="No Documents"
            subtitle="Start by adding your first document"
          />
        </Provider>,
      );
      expect(tree).toMatchSnapshot();
    });

    it('should render with different icon', () => {
      const tree = renderSnapshot(
        <Provider store={store}>
          <GenericEmptyScreen
            title="No Companions"
            subtitle="Add a companion to get started"
          />
        </Provider>,
      );
      expect(tree).toMatchSnapshot();
    });
  });

  describe('EmptyDocumentsScreen', () => {
    it('should render correctly', () => {
      const tree = renderSnapshot(
        <Provider store={store}>
          <EmptyDocumentsScreen />
        </Provider>,
      );
      expect(tree).toMatchSnapshot();
    });
  });
});
