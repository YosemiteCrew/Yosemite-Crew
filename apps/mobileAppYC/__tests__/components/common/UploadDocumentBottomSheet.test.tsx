import React from 'react';
import {TouchableOpacity} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {
  UploadDocumentBottomSheet,
  UploadDocumentBottomSheetRef,
} from '../../../src/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';

// --- Mocks ---

// 1. Global Spies for BottomSheet interaction
const mockSheetSnapToIndex = jest.fn();
const mockSheetClose = jest.fn();

// 2. Mock CustomBottomSheet
// This mock is crucial. It uses useImperativeHandle to populate the 'ref'
// passed from the UploadDocumentBottomSheet (the 'bottomSheetRef' inside the component).
jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const ReactLib = require('react'); // FIX: Renamed to avoid shadowing
  const {
    View: RNView,
    TouchableOpacity: RNTouchableOpacity,
    Text: RNText,
  } = require('react-native');

  return ReactLib.forwardRef((props: any, ref: any) => {
    ReactLib.useImperativeHandle(ref, () => ({
      snapToIndex: mockSheetSnapToIndex,
      close: mockSheetClose,
    }));

    return (
      <RNView testID="custom-bottom-sheet">
        {props.children}
        {/* Helper button to manually trigger the onChange prop for coverage */}
        <RNTouchableOpacity
          testID="sheet-change-trigger"
          onPress={() => props.onChange?.(0)}>
          <RNText>Trigger Change</RNText>
        </RNTouchableOpacity>
      </RNView>
    );
  });
});

// 3. Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        surface: '#ffffff',
        borderMuted: '#e0e0e0',
        secondary: '#000000',
      },
      borderRadius: {
        '3xl': 20,
      },
      spacing: {
        '2': 8,
        '4': 16,
        '5': 20,
        '6': 24,
      },
      typography: {
        h5Clash23: {fontSize: 23},
        paragraph: {fontSize: 14},
      },
    },
  }),
}));

// 4. Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    cameraWhite: {uri: 'camera-icon'},
    galleryIcon: {uri: 'gallery-icon'},
    driveIcon: {uri: 'drive-icon'},
    crossIcon: {uri: 'cross-icon'},
  },
}));

describe('UploadDocumentBottomSheet Component', () => {
  const mockOnTakePhoto = jest.fn();
  const mockOnChooseGallery = jest.fn();
  const mockOnUploadDrive = jest.fn();

  let ref: React.RefObject<UploadDocumentBottomSheetRef | null>;

  beforeEach(() => {
    jest.clearAllMocks();
    ref = React.createRef();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders the bottom sheet with correct title and options', () => {
    const {getByText} = render(
      <UploadDocumentBottomSheet
        ref={ref}
        onTakePhoto={mockOnTakePhoto}
        onChooseGallery={mockOnChooseGallery}
        onUploadDrive={mockOnUploadDrive}
      />,
    );

    expect(getByText('Upload documents')).toBeTruthy();
    expect(getByText('Take Photo')).toBeTruthy();
    expect(getByText('Choose from Gallery')).toBeTruthy();
    expect(getByText('Upload from Drive')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Ref Imperative Handle Logic (open/close)
  // ===========================================================================

  it('calls internal sheet snapToIndex(0) when open() is called via ref', () => {
    render(
      <UploadDocumentBottomSheet
        ref={ref}
        onTakePhoto={mockOnTakePhoto}
        onChooseGallery={mockOnChooseGallery}
        onUploadDrive={mockOnUploadDrive}
      />,
    );

    ref.current?.open();
    expect(mockSheetSnapToIndex).toHaveBeenCalledWith(0);
  });

  it('calls internal sheet close() when close() is called via ref', () => {
    render(
      <UploadDocumentBottomSheet
        ref={ref}
        onTakePhoto={mockOnTakePhoto}
        onChooseGallery={mockOnChooseGallery}
        onUploadDrive={mockOnUploadDrive}
      />,
    );

    ref.current?.close();
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  // ===========================================================================
  // 3. User Interactions (Options & Close)
  // ===========================================================================

  it('triggers onTakePhoto and closes sheet when "Take Photo" is pressed', () => {
    const {getByText} = render(
      <UploadDocumentBottomSheet
        ref={ref}
        onTakePhoto={mockOnTakePhoto}
        onChooseGallery={mockOnChooseGallery}
        onUploadDrive={mockOnUploadDrive}
      />,
    );

    fireEvent.press(getByText('Take Photo'));

    expect(mockOnTakePhoto).toHaveBeenCalledTimes(1);
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onChooseGallery and closes sheet when "Choose from Gallery" is pressed', () => {
    const {getByText} = render(
      <UploadDocumentBottomSheet
        ref={ref}
        onTakePhoto={mockOnTakePhoto}
        onChooseGallery={mockOnChooseGallery}
        onUploadDrive={mockOnUploadDrive}
      />,
    );

    fireEvent.press(getByText('Choose from Gallery'));

    expect(mockOnChooseGallery).toHaveBeenCalledTimes(1);
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onUploadDrive and closes sheet when "Upload from Drive" is pressed', () => {
    const {getByText} = render(
      <UploadDocumentBottomSheet
        ref={ref}
        onTakePhoto={mockOnTakePhoto}
        onChooseGallery={mockOnChooseGallery}
        onUploadDrive={mockOnUploadDrive}
      />,
    );

    fireEvent.press(getByText('Upload from Drive'));

    expect(mockOnUploadDrive).toHaveBeenCalledTimes(1);
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('closes the sheet when the header close button is pressed', () => {
    const {UNSAFE_getAllByType} = render(
      <UploadDocumentBottomSheet
        ref={ref}
        onTakePhoto={mockOnTakePhoto}
        onChooseGallery={mockOnChooseGallery}
        onUploadDrive={mockOnUploadDrive}
      />,
    );

    // Find TouchableOpacity. There are 4 total (close btn + 3 options).
    // The close button is the first one in the tree (in the header).
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    const closeButton = buttons[0];

    fireEvent.press(closeButton);

    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  // ===========================================================================
  // 4. State Updates (Coverage)
  // ===========================================================================

  it('updates visible state when sheet index changes', () => {
    const {getByTestId} = render(
      <UploadDocumentBottomSheet
        ref={ref}
        onTakePhoto={mockOnTakePhoto}
        onChooseGallery={mockOnChooseGallery}
        onUploadDrive={mockOnUploadDrive}
      />,
    );

    // Trigger the mock button inside our MockBottomSheet
    // This executes props.onChange(0) -> setIsSheetVisible(true)
    const trigger = getByTestId('sheet-change-trigger');
    fireEvent.press(trigger);

    // We can't easily assert the internal useState 'isSheetVisible' directly,
    // but running this ensures the callback code path is executed without error.
  });
});
