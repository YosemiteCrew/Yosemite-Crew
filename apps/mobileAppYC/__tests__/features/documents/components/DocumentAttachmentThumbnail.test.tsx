import React from 'react';
import {Image} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import DocumentAttachmentThumbnail from '../../../../src/features/documents/components/DocumentAttachmentThumbnail';
import {
  useThumbStyles,
  resolveThumbSource,
  resolveThumbLabel,
} from '../../../../src/features/documents/components/documentAttachmentUtils';

// --- Mocks ---

// 1. Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    documentIcon: {testUri: 'document-icon'},
    shareIcon: {testUri: 'share-icon'},
  },
}));

// 2. Mock Utils
jest.mock(
  '../../../../src/features/documents/components/documentAttachmentUtils',
  () => ({
    useThumbStyles: jest.fn(),
    resolveThumbSource: jest.fn(),
    resolveThumbLabel: jest.fn(),
  }),
);

describe('DocumentAttachmentThumbnail', () => {
  const mockFile = {id: '1', name: 'test.pdf', type: 'pdf'};
  const mockOnShare = jest.fn();

  // Mock styles object to return from useThumbStyles
  const mockStyles = {
    previewCard: {backgroundColor: 'red'},
    previewImage: {width: 100},
    pdfPlaceholder: {height: 100},
    pdfIcon: {width: 20},
    pdfLabel: {color: 'black'},
    pageIndicator: {fontSize: 12},
    shareButton: {padding: 10},
    shareIcon: {width: 20},
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    (useThumbStyles as jest.Mock).mockReturnValue({styles: mockStyles});
    (resolveThumbSource as jest.Mock).mockReturnValue({
      isImage: false,
      source: null,
    });
    (resolveThumbLabel as jest.Mock).mockReturnValue('Test Label');
  });

  // --- 1. Rendering: Image State ---

  it('renders the image view when file resolves to an image source', () => {
    (resolveThumbSource as jest.Mock).mockReturnValue({
      isImage: true,
      source: 'http://example.com/image.jpg',
    });

    const {UNSAFE_getAllByType, getByText} = render(
      <DocumentAttachmentThumbnail
        file={mockFile as any}
        index={0}
        total={3}
        onShare={mockOnShare}
      />,
    );

    // Verify Image Rendered
    const images = UNSAFE_getAllByType(Image);
    // There should be 2 images: the main preview image + share icon
    const previewImage = images.find(
      img => img.props.source.uri === 'http://example.com/image.jpg',
    );
    expect(previewImage).toBeTruthy();

    // Verify Page Indicator
    expect(getByText('Document 1 of 3')).toBeTruthy();
  });

  // --- 2. Rendering: Placeholder State (e.g. PDF) ---

  it('renders the placeholder view when file is not an image', () => {
    (resolveThumbSource as jest.Mock).mockReturnValue({
      isImage: false,
      source: null,
    });
    (resolveThumbLabel as jest.Mock).mockReturnValue('My Document.pdf');

    const {getByText, UNSAFE_getAllByType} = render(
      <DocumentAttachmentThumbnail
        file={mockFile as any}
        index={1}
        total={5}
        onShare={mockOnShare}
      />,
    );

    // Verify Label
    expect(getByText('My Document.pdf')).toBeTruthy();

    // Verify Placeholder Icon (documentIcon)
    const images = UNSAFE_getAllByType(Image);
    const docIcon = images.find(
      // @ts-ignore
      img => img.props.source.testUri === 'document-icon',
    );
    expect(docIcon).toBeTruthy();

    // Verify Page Indicator
    expect(getByText('Document 2 of 5')).toBeTruthy();
  });

  // --- 3. Interaction: Sharing ---

  it('calls onShare with the correct file when share button is pressed', () => {
    const {getByRole} = render(
      <DocumentAttachmentThumbnail
        file={mockFile as any}
        index={0}
        total={1}
        onShare={mockOnShare}
      />,
    );

    const shareButton = getByRole('button', {name: 'Share attachment'});
    fireEvent.press(shareButton);

    expect(mockOnShare).toHaveBeenCalledTimes(1);
    expect(mockOnShare).toHaveBeenCalledWith(mockFile);
  });
});
