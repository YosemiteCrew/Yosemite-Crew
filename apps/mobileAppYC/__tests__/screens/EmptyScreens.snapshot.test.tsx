// __tests__/screens/EmptyScreens.snapshot.test.tsx
import React from 'react';
import renderer from 'react-test-renderer';
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

// Drain pending async work (mount effects, theme dispatch) then unmount so the
// tree never re-renders after the Jest environment is torn down.
const drainAndUnmount = async (tree: renderer.ReactTestRenderer) => {
  for (let i = 0; i < 3; i++) {
    await renderer.act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
  await renderer.act(async () => {
    tree.unmount();
  });
};

describe('Empty Screen Snapshots', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('GenericEmptyScreen', () => {
    it('should render with minimal props', async () => {
      const tree = renderer.create(
        <Provider store={store}>
          <GenericEmptyScreen title="Empty" subtitle="No items found" />
        </Provider>,
      );
      expect(tree.toJSON()).toMatchSnapshot();
      await drainAndUnmount(tree);
    });

    it('should render with all props', async () => {
      const tree = renderer.create(
        <Provider store={store}>
          <GenericEmptyScreen
            title="No Documents"
            subtitle="Start by adding your first document"
          />
        </Provider>,
      );
      expect(tree.toJSON()).toMatchSnapshot();
      await drainAndUnmount(tree);
    });

    it('should render with different icon', async () => {
      const tree = renderer.create(
        <Provider store={store}>
          <GenericEmptyScreen
            title="No Companions"
            subtitle="Add a companion to get started"
          />
        </Provider>,
      );
      expect(tree.toJSON()).toMatchSnapshot();
      await drainAndUnmount(tree);
    });
  });

  describe('EmptyDocumentsScreen', () => {
    it('should render correctly', async () => {
      const tree = renderer.create(
        <Provider store={store}>
          <EmptyDocumentsScreen />
        </Provider>,
      );
      expect(tree.toJSON()).toMatchSnapshot();
      await drainAndUnmount(tree);
    });
  });
});
