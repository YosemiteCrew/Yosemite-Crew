import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {AttachmentPreview} from '../../../src/shared/components/common/AttachmentPreview/AttachmentPreview';
import {Share, Alert, Image} from 'react-native';

// --- Mocks ---

// Mock Images asset
jest.mock('@/assets/images', () => ({
  Images: {
    documentIcon: {uri: 'document-icon-png'},
    shareIcon: {uri: 'share-icon-png'},
  },
}));

// Mock useTheme
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
      },
    },
  }),
}));

// Mock attachmentStyles
jest.mock('@/shared/utils/attachmentStyles', () =>
  jest.fn(() => ({
    container: {padding: 10},
    previewCard: {marginBottom: 10},
    previewImage: {width: 100, height: 100},
    pdfPlaceholder: {backgroundColor: 'gray'},
    pdfIcon: {width: 20, height: 20},
    pdfLabel: {fontSize: 12},
    pageIndicator: {marginTop: 5},
    shareButton: {position: 'absolute'},
    shareIcon: {width: 24, height: 24},
  })),
);

// Spy on Share and Alert
const shareSpy = jest.spyOn(Share, 'share');
const alertSpy = jest.spyOn(Alert, 'alert');

describe('AttachmentPreview Component', () => {
  const mockImageAttachment = {
    id: '1',
    type: 'image/jpeg',
    s3Url: 'https://example.com/photo.jpg',
    name: 'photo.jpg',
  };

  const mockPdfAttachment = {
    id: '2',
    type: 'application/pdf',
    uri: 'file:///local/doc.pdf',
    name: 'document.pdf',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================
  it('renders nothing if attachments array is empty or undefined', () => {
    const {toJSON} = render(<AttachmentPreview attachments={[]} />);
    expect(toJSON()).toBeNull();

    // Fix: Cast undefined to any or use ts-ignore correctly
    // @ts-ignore
    const {toJSON: toJSONUndefined} = render(
      <AttachmentPreview attachments={undefined as any} />,
    );
    expect(toJSONUndefined()).toBeNull();
  });

  it('renders an Image component when file type is image/', () => {
    const {UNSAFE_getAllByType} = render(
      <AttachmentPreview attachments={[mockImageAttachment]} />,
    );
    const images = UNSAFE_getAllByType(Image);

    // Should find at least 2 images: The preview image AND the share icon
    // The Preview Image should have the correct source
    const previewImage = images.find(
      i => i.props.source?.uri === 'https://example.com/photo.jpg',
    );
    expect(previewImage).toBeTruthy();
  });

  it('renders a PDF placeholder when file type is NOT image/', () => {
    const {getByText, UNSAFE_getAllByType} = render(
      <AttachmentPreview attachments={[mockPdfAttachment]} />,
    );

    // Should render filename
    expect(getByText('document.pdf')).toBeTruthy();

    const images = UNSAFE_getAllByType(Image);
    // Should NOT find the preview image source, but should find document icon
    const docIcon = images.find(
      i => i.props.source?.uri === 'document-icon-png',
    );
    expect(docIcon).toBeTruthy();
  });

  it('renders page indicator correctly', () => {
    const {getByText} = render(
      <AttachmentPreview attachments={[mockImageAttachment]} />,
    );
    expect(getByText('Page 1 of 1')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Logic & Edge Cases
  // ===========================================================================

  it('prioritizes s3Url over uri', () => {
    const dualSourceAttachment = {
      id: '3',
      type: 'image/png',
      s3Url: 'https://cloud.com/img.png',
      uri: 'file:///local/img.png',
    };

    const {UNSAFE_getAllByType} = render(
      <AttachmentPreview attachments={[dualSourceAttachment]} />,
    );

    const images = UNSAFE_getAllByType(Image);
    const preview = images.find(
      i => i.props.source?.uri === 'https://cloud.com/img.png',
    );
    expect(preview).toBeTruthy();
  });

  it('falls back to uri if s3Url is missing', () => {
    const localOnlyAttachment = {
      id: '4',
      type: 'image/png',
      uri: 'file:///local/fallback.png',
    };

    const {UNSAFE_getAllByType} = render(
      <AttachmentPreview attachments={[localOnlyAttachment]} />,
    );

    const images = UNSAFE_getAllByType(Image);
    const preview = images.find(
      i => i.props.source?.uri === 'file:///local/fallback.png',
    );
    expect(preview).toBeTruthy();
  });

  // ===========================================================================
  // 3. Interaction (Sharing)
  // ===========================================================================

  it('calls Share.share with correct URL when share button is pressed', async () => {
    // Mock successful share
    shareSpy.mockResolvedValue({action: Share.sharedAction});

    const {UNSAFE_getAllByType} = render(
      <AttachmentPreview attachments={[mockImageAttachment]} />,
    );

    // Find share button (TouchableOpacity inside the preview card)
    // The share icon is inside the button.
    const images = UNSAFE_getAllByType(Image);
    const shareIcon = images.find(
      i => i.props.source?.uri === 'share-icon-png',
    );

    // Press the parent TouchableOpacity of the share icon
    fireEvent.press(shareIcon?.parent as any);

    expect(shareSpy).toHaveBeenCalledWith({
      message: 'Shared file',
      url: 'https://example.com/photo.jpg',
    });
  });

  it('handles Share API error gracefully by showing Alert', async () => {
    // Mock share failure
    shareSpy.mockRejectedValue(new Error('Share failed'));

    const {UNSAFE_getAllByType} = render(
      <AttachmentPreview attachments={[mockImageAttachment]} />,
    );

    const images = UNSAFE_getAllByType(Image);
    const shareIcon = images.find(
      i => i.props.source?.uri === 'share-icon-png',
    );

    fireEvent.press(shareIcon?.parent as any);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Share failed');
    });
  });

  it('handles empty/null url in Share gracefully', async () => {
    // Case where both s3Url and uri are undefined
    const brokenAttachment = {id: '5', type: 'image/png'};

    const {UNSAFE_getAllByType} = render(
      <AttachmentPreview attachments={[brokenAttachment]} />,
    );

    const images = UNSAFE_getAllByType(Image);
    const shareIcon = images.find(
      i => i.props.source?.uri === 'share-icon-png',
    );

    fireEvent.press(shareIcon?.parent as any);

    expect(shareSpy).toHaveBeenCalledWith({
      message: 'Shared file',
      url: '', // Should fallback to empty string
    });
  });
});
