import {renderHook} from '@testing-library/react-native';
import {useDocumentUpload} from '../../src/shared/hooks/useDocumentUpload';
// FIX: Import named exports directly instead of 'import * as hooks'
import {useFormBottomSheets, useFileOperations} from '../../src/hooks';

// --- Mocks ---

// Mock internal hooks
jest.mock('../../src/hooks', () => ({
  useFormBottomSheets: jest.fn(),
  useFileOperations: jest.fn(),
}));

describe('useDocumentUpload Hook', () => {
  const mockSetFiles = jest.fn();
  // Mock file object matching DocumentFile type structure
  const mockFiles = [
    {id: '1', name: 'file1.pdf', uri: 'uri', type: 'pdf', size: 100},
  ];

  // Internal mocks for the dependencies
  const mockOpenSheet = jest.fn();
  const mockCloseSheet = jest.fn();
  const mockUploadSheetRef = {current: 'upload-ref'};
  const mockDeleteSheetRef = {current: 'delete-ref'};

  const mockFileOps = {
    fileToDelete: '1',
    handleTakePhoto: jest.fn(),
    handleChooseFromGallery: jest.fn(),
    handleUploadFromDrive: jest.fn(),
    handleRemoveFile: jest.fn(),
    confirmDeleteFile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    // FIX: Cast named imports to jest.Mock
    (useFormBottomSheets as jest.Mock).mockReturnValue({
      refs: {
        uploadSheetRef: mockUploadSheetRef,
        deleteSheetRef: mockDeleteSheetRef,
      },
      openSheet: mockOpenSheet,
      closeSheet: mockCloseSheet,
    });

    (useFileOperations as jest.Mock).mockReturnValue(mockFileOps);
  });

  // ===========================================================================
  // 1. Initialization & Composition
  // ===========================================================================

  it('correctly composes dependencies and returns combined interface', () => {
    const {result} = renderHook(() =>
      useDocumentUpload({files: mockFiles, setFiles: mockSetFiles}),
    );

    // Verify Refs
    expect(result.current.refs.uploadSheetRef).toBe(mockUploadSheetRef);
    expect(result.current.refs.deleteSheetRef).toBe(mockDeleteSheetRef);

    // Verify Sheet Control
    expect(result.current.openSheet).toBe(mockOpenSheet);
    expect(result.current.closeSheet).toBe(mockCloseSheet);

    // Verify State
    expect(result.current.files).toBe(mockFiles);
    expect(result.current.fileToDelete).toBe('1');

    // Verify Operations
    expect(result.current.handleTakePhoto).toBe(mockFileOps.handleTakePhoto);
    expect(result.current.handleChooseFromGallery).toBe(
      mockFileOps.handleChooseFromGallery,
    );
    expect(result.current.handleUploadFromDrive).toBe(
      mockFileOps.handleUploadFromDrive,
    );
    expect(result.current.handleRemoveFile).toBe(mockFileOps.handleRemoveFile);
    expect(result.current.confirmDeleteFile).toBe(
      mockFileOps.confirmDeleteFile,
    );
  });

  // ===========================================================================
  // 2. Argument Passing Logic
  // ===========================================================================

  it('passes correct arguments to useFileOperations', () => {
    renderHook(() =>
      useDocumentUpload({files: mockFiles, setFiles: mockSetFiles}),
    );

    expect(useFileOperations).toHaveBeenCalledWith(
      expect.objectContaining({
        files: mockFiles,
        setFiles: mockSetFiles,
        openSheet: mockOpenSheet,
        closeSheet: mockCloseSheet,
        deleteSheetRef: mockDeleteSheetRef,
        // clearError is an anonymous function in the source
        clearError: expect.any(Function),
      }),
    );
  });

  it('provides a no-op clearError function to useFileOperations', () => {
    // We capture the config object passed to useFileOperations to test the anonymous function
    renderHook(() =>
      useDocumentUpload({files: mockFiles, setFiles: mockSetFiles}),
    );

    // FIX: Access calls on the named import mock
    const callArgs = (useFileOperations as jest.Mock).mock.calls[0][0];
    const {clearError} = callArgs;

    // Verify it is a function and calling it doesn't crash (is no-op)
    expect(typeof clearError).toBe('function');
    expect(() => clearError()).not.toThrow();
  });
});