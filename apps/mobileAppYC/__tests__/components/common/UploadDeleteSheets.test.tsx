import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {
  UploadDeleteSheets,
  UploadDeleteSheetsProps,
} from '../../../src/shared/components/common/UploadDeleteSheets/UploadDeleteSheets';

// --- Mocks ---

// Mock UploadDocumentBottomSheet
jest.mock(
  '../../../src/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet',
  () => {
    const ReactLib = require('react');
    const {View: RNView, Button: RNButton} = require('react-native');
    // Mock implementation that exposes the action buttons
    const UploadDocumentBottomSheet = ReactLib.forwardRef(
      (props: any, _ref: any) => (
        <RNView testID="upload-sheet">
          <RNButton title="Take Photo" onPress={props.onTakePhoto} />
          <RNButton title="Choose Gallery" onPress={props.onChooseGallery} />
          <RNButton title="Upload Drive" onPress={props.onUploadDrive} />
        </RNView>
      ),
    );
    return {UploadDocumentBottomSheet};
  },
);

// Mock DeleteDocumentBottomSheet
jest.mock(
  '../../../src/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
  () => {
    const ReactLib = require('react');
    const {
      View: RNView,
      Text: RNText,
      Button: RNButton,
    } = require('react-native');
    // Mock implementation that displays the title to test logic
    const DeleteDocumentBottomSheet = ReactLib.forwardRef(
      (props: any, _ref: any) => (
        <RNView testID="delete-sheet">
          <RNText>{props.documentTitle}</RNText>
          <RNButton title="Confirm Delete" onPress={props.onDelete} />
        </RNView>
      ),
    );
    return {DeleteDocumentBottomSheet};
  },
);

describe('UploadDeleteSheets Component', () => {
  const mockOnTakePhoto = jest.fn();
  const mockOnChooseGallery = jest.fn();
  const mockOnUploadDrive = jest.fn();
  const mockOnConfirmDelete = jest.fn();
  const mockCloseSheet = jest.fn();

  // Refs (can be null for initial render test)
  const uploadSheetRef = {current: null};
  const deleteSheetRef = {current: null};

  const mockFiles = [
    {id: '1', name: 'FileOne.pdf'},
    {id: '2', name: 'ImageTwo.jpg'},
  ];

  const defaultProps: UploadDeleteSheetsProps = {
    uploadSheetRef,
    deleteSheetRef,
    files: mockFiles,
    fileToDelete: null,
    onTakePhoto: mockOnTakePhoto,
    onChooseGallery: mockOnChooseGallery,
    onUploadDrive: mockOnUploadDrive,
    onConfirmDelete: mockOnConfirmDelete,
    closeSheet: mockCloseSheet,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders both sheets correctly', () => {
    const {getByTestId} = render(<UploadDeleteSheets {...defaultProps} />);
    expect(getByTestId('upload-sheet')).toBeTruthy();
    expect(getByTestId('delete-sheet')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Upload Sheet Interactions
  // ===========================================================================

  it('calls onTakePhoto and then closeSheet', () => {
    const {getByText} = render(<UploadDeleteSheets {...defaultProps} />);
    fireEvent.press(getByText('Take Photo'));

    expect(mockOnTakePhoto).toHaveBeenCalledTimes(1);
    expect(mockCloseSheet).toHaveBeenCalledTimes(1);
  });

  it('calls onChooseGallery and then closeSheet', () => {
    const {getByText} = render(<UploadDeleteSheets {...defaultProps} />);
    fireEvent.press(getByText('Choose Gallery'));

    expect(mockOnChooseGallery).toHaveBeenCalledTimes(1);
    expect(mockCloseSheet).toHaveBeenCalledTimes(1);
  });

  it('calls onUploadDrive and then closeSheet', () => {
    const {getByText} = render(<UploadDeleteSheets {...defaultProps} />);
    fireEvent.press(getByText('Upload Drive'));

    expect(mockOnUploadDrive).toHaveBeenCalledTimes(1);
    expect(mockCloseSheet).toHaveBeenCalledTimes(1);
  });

  // ===========================================================================
  // 3. Delete Sheet Logic (Title Generation)
  // ===========================================================================

  it('displays correct file name when fileToDelete ID exists', () => {
    const {getByText} = render(
      <UploadDeleteSheets {...defaultProps} fileToDelete="1" />,
    );
    // Should find 'FileOne.pdf' inside the mock delete sheet
    expect(getByText('FileOne.pdf')).toBeTruthy();
  });

  it('displays "this file" when fileToDelete is null', () => {
    const {getByText} = render(
      <UploadDeleteSheets {...defaultProps} fileToDelete={null} />,
    );
    expect(getByText('this file')).toBeTruthy();
  });

  it('displays "this file" when fileToDelete ID is not found in files array', () => {
    const {getByText} = render(
      <UploadDeleteSheets {...defaultProps} fileToDelete="999" />,
    );
    expect(getByText('this file')).toBeTruthy();
  });

  // ===========================================================================
  // 4. Delete Sheet Interaction
  // ===========================================================================

  it('calls onConfirmDelete when delete is confirmed', () => {
    const {getByText} = render(
      <UploadDeleteSheets {...defaultProps} fileToDelete="1" />,
    );

    fireEvent.press(getByText('Confirm Delete'));
    expect(mockOnConfirmDelete).toHaveBeenCalledTimes(1);
  });
});
