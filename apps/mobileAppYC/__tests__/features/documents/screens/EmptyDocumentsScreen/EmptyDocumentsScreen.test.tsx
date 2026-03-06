import React from 'react';
import {render} from '@testing-library/react-native';
import {EmptyDocumentsScreen} from '@/features/documents/screens/EmptyDocumentsScreen/EmptyDocumentsScreen';
import {GenericEmptyScreen} from '@/shared/screens/common/GenericEmptyScreen';
import {Images} from '@/assets/images';

// --- Mocks ---

// 1. Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    emptyDocuments: {uri: 'test_empty_docs_image.png'},
  },
}));

// 2. Mock Shared Component
// We mock this component to verify the props passed to it
jest.mock('@/shared/screens/common/GenericEmptyScreen', () => ({
  GenericEmptyScreen: jest.fn(() => null),
}));

describe('EmptyDocumentsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Prop Verification ---

  it('renders GenericEmptyScreen with the correct configuration', () => {
    render(<EmptyDocumentsScreen />);

    // Verify GenericEmptyScreen was called with the specific props defined in the component
    expect(GenericEmptyScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        headerTitle: 'Documents',
        emptyImage: Images.emptyDocuments,
        title: 'Meow-nothing here.',
        subtitle: expect.stringContaining('vaccine or\nmedical reports'),
        showBackButton: false,
      }),
      undefined, // The second argument (context) is undefined in this test environment
    );
  });
});
