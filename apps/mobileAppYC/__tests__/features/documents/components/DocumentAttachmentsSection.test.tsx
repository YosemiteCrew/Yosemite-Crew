import React from 'react';
import {Image} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import DocumentAttachmentsSection from '../../../../src/features/documents/components/DocumentAttachmentsSection';
import {isImageFile} from '../../../../src/features/documents/components/documentAttachmentUtils';

// --- Mocks ---

// 1. Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        border: '#ccc',
        surface: '#fff',
        secondary: '#000',
        textSecondary: '#666',
        white: '#fff',
        error: '#f00',
      },
      borderRadius: {lg: 8, base: 4},
      spacing: {2: 8, 3: 12, 5: 20, 6: 24},
      typography: {
        titleMedium: {fontSize: 16},
        labelXsBold: {fontSize: 12, fontWeight: 'bold'},
      },
    },
  }),
}));

// 2. Mock Assets (Inline to avoid hoisting issues)
jest.mock('@/assets/images', () => ({
  Images: {
    uploadIcon: {testUri: 'upload-icon'},
    documentIcon: {testUri: 'doc-icon'},
    closeIcon: {testUri: 'close-icon'},
    addIconWhite: {testUri: 'add-icon-white'},
  },
}));

// 3. Mock Utils
jest.mock(
  '../../../../src/features/documents/components/documentAttachmentUtils',
  () => ({
    isImageFile: jest.fn(),
  }),
);

describe('DocumentAttachmentsSection', () => {
  const mockOnAddPress = jest.fn();
  const mockOnRequestRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Empty State Tests ---

  it('renders the default empty state correctly', () => {
    const {getByText} = render(
      <DocumentAttachmentsSection
        files={[]}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
      />,
    );

    expect(getByText('Upload documents')).toBeTruthy();
    expect(getByText(/Only DOC, PDF/)).toBeTruthy();
  });

  it('renders custom empty title and subtitle', () => {
    const {getByText} = render(
      <DocumentAttachmentsSection
        files={[]}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
        emptyTitle="No Files"
        emptySubtitle="Add something"
      />,
    );

    expect(getByText('No Files')).toBeTruthy();
    expect(getByText('Add something')).toBeTruthy();
  });

  it('triggers onAddPress when empty state is pressed', () => {
    const {getByText} = render(
      <DocumentAttachmentsSection
        files={[]}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
        emptyTitle="Press Me"
      />,
    );

    fireEvent.press(getByText('Press Me'));
    expect(mockOnAddPress).toHaveBeenCalledTimes(1);
  });

  // --- 2. List State (Non-Image Files) ---

  it('renders a list of non-image files with placeholders', () => {
    (isImageFile as jest.Mock).mockReturnValue(false);

    const files = [
      {id: '1', name: 'Contract.pdf', type: 'pdf', status: 'success'},
      {id: '2', name: 'Resume.docx', type: 'docx', status: 'pending'},
    ];

    const {getByText} = render(
      <DocumentAttachmentsSection
        files={files as any}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
      />,
    );

    expect(getByText('Contract.pdf')).toBeTruthy();
    expect(getByText('Resume.docx')).toBeTruthy();
  });

  it('calls onRequestRemove when delete button is clicked', () => {
    (isImageFile as jest.Mock).mockReturnValue(false);
    const file = {id: '1', name: 'test.pdf'};

    const {UNSAFE_getAllByType} = render(
      <DocumentAttachmentsSection
        files={[file] as any}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
      />,
    );

    // Find the image with the closeIcon source
    const images = UNSAFE_getAllByType(Image);
    const closeIcon = images.find(
      // @ts-ignore
      img => img.props.source?.testUri === 'close-icon',
    );

    expect(closeIcon).toBeTruthy();

    // Fire press on the parent TouchableOpacity of the close icon
    fireEvent.press(closeIcon!.parent!);

    expect(mockOnRequestRemove).toHaveBeenCalledWith(file);
  });

  // --- 3. List State (Image Files & Source Resolution) ---

  it('renders image files with correct resolved URIs', () => {
    (isImageFile as jest.Mock).mockReturnValue(true);

    const files = [
      {id: '1', name: 'web.jpg', uri: 'http://site.com/pic.jpg', type: 'jpg'},
      {id: '2', name: 'local.png', uri: 'path/to/pic.png', type: 'png'},
      {id: '3', name: 'file.png', uri: 'file://path/pic.png', type: 'png'},
      {
        id: '4',
        name: 'fallback.jpg',
        viewUrl: 'http://fallback.com',
        type: 'jpg',
      },
    ];

    const {UNSAFE_getAllByType} = render(
      <DocumentAttachmentsSection
        files={files as any}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
      />,
    );

    const images = UNSAFE_getAllByType(Image);

    // Helper to find image by URI in the rendered tree
    const findImageSource = (uri: string) =>
      images.find(img => img.props.source?.uri === uri);

    // 1. HTTP URI -> kept as is
    expect(findImageSource('http://site.com/pic.jpg')).toBeTruthy();

    // 2. Local Path -> prepended with file://
    expect(findImageSource('file://path/to/pic.png')).toBeTruthy();

    // 3. File URI -> cleaned and prepended (regex ensures single file://)
    expect(findImageSource('file://path/pic.png')).toBeTruthy();

    // 4. No URI -> Fallback to viewUrl
    expect(findImageSource('http://fallback.com')).toBeTruthy();
  });

  it('handles image loading states (Start, End, Error)', () => {
    (isImageFile as jest.Mock).mockReturnValue(true);
    const file = {id: '1', uri: 'http://img.com', type: 'png'};

    const {UNSAFE_getAllByType} = render(
      <DocumentAttachmentsSection
        files={[file] as any}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
      />,
    );

    // Find the specific content image, not icons
    const images = UNSAFE_getAllByType(Image);
    const contentImage = images.find(
      img => img.props.source?.uri === 'http://img.com',
    );

    expect(contentImage).toBeTruthy();

    // Trigger loading events to ensure no crashes (state updates)
    fireEvent(contentImage!, 'onLoadStart');
    fireEvent(contentImage!, 'onLoadEnd');
    fireEvent(contentImage!, 'onError');

    // Since state is internal, we primarily verify that event handlers execute safely
    expect(contentImage).toBeTruthy();
  });

  // --- 4. Add Button & Error Handling ---

  it('shows add button tile by default and handles press', () => {
    (isImageFile as jest.Mock).mockReturnValue(false);

    const {UNSAFE_getAllByType} = render(
      <DocumentAttachmentsSection
        files={[{id: '1'} as any]} // Need items to show list view
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
      />,
    );

    const images = UNSAFE_getAllByType(Image);
    const addIcon = images.find(
      // @ts-ignore
      img => img.props.source?.testUri === 'add-icon-white',
    );

    expect(addIcon).toBeTruthy();
    fireEvent.press(addIcon!.parent!);

    expect(mockOnAddPress).toHaveBeenCalled();
  });

  it('hides add button when hideAddButton is true', () => {
    (isImageFile as jest.Mock).mockReturnValue(false);

    const {UNSAFE_getAllByType} = render(
      <DocumentAttachmentsSection
        files={[{id: '1'} as any]}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
        hideAddButton={true}
      />,
    );

    const images = UNSAFE_getAllByType(Image);
    const addIcon = images.find(
      // @ts-ignore
      img => img.props.source?.testUri === 'add-icon-white',
    );

    expect(addIcon).toBeUndefined();
  });

  it('displays error text when error prop is provided', () => {
    const {getByText} = render(
      <DocumentAttachmentsSection
        files={[]}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
        error="File too large"
      />,
    );

    expect(getByText('File too large')).toBeTruthy();
  });

  // --- 5. Edge Case: Preview Source Fallbacks ---

  it('falls back through viewUrl -> downloadUrl -> s3Url -> null correctly', () => {
    (isImageFile as jest.Mock).mockReturnValue(true);

    // Test fallback chain
    const file1 = {id: '1', downloadUrl: 'http://dl.com', type: 'png'};
    const file2 = {id: '2', s3Url: 'http://s3.com', type: 'png'};

    const {UNSAFE_getAllByType} = render(
      <DocumentAttachmentsSection
        files={[file1, file2] as any}
        onAddPress={mockOnAddPress}
        onRequestRemove={mockOnRequestRemove}
      />,
    );

    const images = UNSAFE_getAllByType(Image);

    // Verify fallbacks were picked up
    expect(
      images.find(img => img.props.source?.uri === 'http://dl.com'),
    ).toBeTruthy();
    expect(
      images.find(img => img.props.source?.uri === 'http://s3.com'),
    ).toBeTruthy();
  });
});
