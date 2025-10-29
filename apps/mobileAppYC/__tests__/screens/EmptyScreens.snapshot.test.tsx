// __tests__/screens/EmptyScreens.snapshot.test.tsx
import React from 'react';
import renderer from 'react-test-renderer';
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

describe('Empty Screen Snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GenericEmptyScreen', () => {
    it('should render with minimal props', () => {
      const tree = renderer.create(
        <GenericEmptyScreen
          title="Empty"
          subtitle="No items found"
        />
      ).toJSON();
      expect(tree).toMatchSnapshot();
    });

    it('should render with all props', () => {
      const tree = renderer.create(
        <GenericEmptyScreen
          title="No Documents"
          subtitle="Start by adding your first document"
        />
      ).toJSON();
      expect(tree).toMatchSnapshot();
    });

    it('should render with different icon', () => {
      const tree = renderer.create(
        <GenericEmptyScreen
          title="No Companions"
          subtitle="Add a companion to get started"
        />
      ).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });

  describe('EmptyDocumentsScreen', () => {
    it('should render correctly', () => {
      const tree = renderer.create(
        <EmptyDocumentsScreen />
      ).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });
});
