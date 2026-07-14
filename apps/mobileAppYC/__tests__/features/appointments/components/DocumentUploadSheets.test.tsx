import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {DocumentUploadSheets} from '@/features/appointments/components/DocumentUploadSheets';

jest.mock(
  '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return {
      UploadDocumentBottomSheet: (props: any) => (
        <View testID="upload-sheet">
          <TouchableOpacity testID="take-photo" onPress={props.onTakePhoto}>
            <Text>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="choose-gallery"
            onPress={props.onChooseGallery}>
            <Text>Choose Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="upload-drive" onPress={props.onUploadDrive}>
            <Text>Upload Drive</Text>
          </TouchableOpacity>
        </View>
      ),
    };
  },
);

jest.mock(
  '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return {
      DeleteDocumentBottomSheet: (props: any) => (
        <View testID="delete-sheet">
          <Text testID="delete-title">{props.documentTitle}</Text>
          <TouchableOpacity testID="confirm-delete" onPress={props.onDelete}>
            <Text>Delete</Text>
          </TouchableOpacity>
        </View>
      ),
    };
  },
);

describe('DocumentUploadSheets', () => {
  const files = [
    {id: 'f1', name: 'Vaccine record.pdf'},
    {id: 'f2', name: 'X-ray.png'},
  ] as any;

  const baseProps = {
    uploadSheetRef: {current: null},
    deleteSheetRef: {current: null},
    fileToDelete: null,
    files,
    onTakePhoto: jest.fn(),
    onChooseGallery: jest.fn(),
    onUploadDrive: jest.fn(),
    confirmDeleteFile: jest.fn(),
    closeSheet: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onTakePhoto and closes the upload sheet when take photo is pressed', () => {
    const {getByTestId} = render(<DocumentUploadSheets {...baseProps} />);
    fireEvent.press(getByTestId('take-photo'));

    expect(baseProps.onTakePhoto).toHaveBeenCalledTimes(1);
    expect(baseProps.closeSheet).toHaveBeenCalledWith('upload');
  });

  it('calls onChooseGallery and closes the upload sheet when choose gallery is pressed', () => {
    const {getByTestId} = render(<DocumentUploadSheets {...baseProps} />);
    fireEvent.press(getByTestId('choose-gallery'));

    expect(baseProps.onChooseGallery).toHaveBeenCalledTimes(1);
    expect(baseProps.closeSheet).toHaveBeenCalledWith('upload');
  });

  it('calls onUploadDrive and closes the upload sheet when upload drive is pressed', () => {
    const {getByTestId} = render(<DocumentUploadSheets {...baseProps} />);
    fireEvent.press(getByTestId('upload-drive'));

    expect(baseProps.onUploadDrive).toHaveBeenCalledTimes(1);
    expect(baseProps.closeSheet).toHaveBeenCalledWith('upload');
  });

  it('shows the matching file name when fileToDelete matches a known file', () => {
    const {getByTestId} = render(
      <DocumentUploadSheets {...baseProps} fileToDelete="f2" />,
    );

    expect(getByTestId('delete-title').props.children).toBe('X-ray.png');
  });

  it('shows no title when fileToDelete does not match any known file', () => {
    const {getByTestId} = render(
      <DocumentUploadSheets {...baseProps} fileToDelete="unknown-id" />,
    );

    expect(getByTestId('delete-title').props.children).toBeUndefined();
  });

  it('falls back to "this file" when fileToDelete is null', () => {
    const {getByTestId} = render(<DocumentUploadSheets {...baseProps} />);

    expect(getByTestId('delete-title').props.children).toBe('this file');
  });

  it('calls confirmDeleteFile when delete is confirmed', () => {
    const {getByTestId} = render(<DocumentUploadSheets {...baseProps} />);
    fireEvent.press(getByTestId('confirm-delete'));

    expect(baseProps.confirmDeleteFile).toHaveBeenCalledTimes(1);
  });
});
