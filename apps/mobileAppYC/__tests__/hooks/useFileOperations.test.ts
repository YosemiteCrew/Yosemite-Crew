import { renderHook, act } from '@testing-library/react-hooks';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useDocumentFileHandlers } from '@/hooks/useDocumentFileHandlers';
import type { DocumentFile } from '@/types/document.types';

// --- Mocks ---

// Mock the dependency hook
jest.mock('@/hooks/useDocumentFileHandlers');

// Type-cast the mock for easier use
const mockedUseDocumentFileHandlers = useDocumentFileHandlers as jest.Mock;

// Mock return functions from the dependency hook
const mockHandleTakePhoto = jest.fn();
const mockHandleChooseFromGallery = jest.fn();
const mockHandleUploadFromDrive = jest.fn();

// --- Mock Data ---
const mockFile1: DocumentFile = { id: 'file-1', name: 'test1.pdf', uri: 'file://test1.pdf', type: 'application/pdf', size: 123 };
const mockFile2: DocumentFile = { id: 'file-2', name: 'test2.jpg', uri: 'file://test2.jpg', type: 'image/jpeg', size: 456 };
const initialFiles = [mockFile1, mockFile2];

// --- Test Suite ---

describe('useFileOperations', () => {
  // Mock props for the hook
  const mockSetFiles = jest.fn();
  const mockClearError = jest.fn();
  const mockOpenSheet = jest.fn();
  const mockCloseSheet = jest.fn();
  const mockDeleteSheetRef = { current: { open: jest.fn() } };

  const defaultProps = {
    files: initialFiles,
    setFiles: mockSetFiles,
    clearError: mockClearError,
    openSheet: mockOpenSheet,
    closeSheet: mockCloseSheet,
    deleteSheetRef: mockDeleteSheetRef,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Reset the return value of the mocked hook
    mockedUseDocumentFileHandlers.mockReturnValue({
      handleTakePhoto: mockHandleTakePhoto,
      handleChooseFromGallery: mockHandleChooseFromGallery,
      handleUploadFromDrive: mockHandleUploadFromDrive,
    });
  });

  it('should initialize with fileToDelete as null', () => {
    const { result } = renderHook(() => useFileOperations(defaultProps));
    expect(result.current.fileToDelete).toBeNull();
  });

  it('should call useDocumentFileHandlers with correct props', () => {
    renderHook(() => useFileOperations(defaultProps));

    expect(mockedUseDocumentFileHandlers).toHaveBeenCalledTimes(1);
    expect(mockedUseDocumentFileHandlers).toHaveBeenCalledWith({
      files: initialFiles,
      setFiles: mockSetFiles,
      clearError: mockClearError,
    });
  });

  it('should return handlers from useDocumentFileHandlers', () => {
    const { result } = renderHook(() => useFileOperations(defaultProps));

    expect(result.current.handleTakePhoto).toBe(mockHandleTakePhoto);
    expect(result.current.handleChooseFromGallery).toBe(mockHandleChooseFromGallery);
    expect(result.current.handleUploadFromDrive).toBe(mockHandleUploadFromDrive);
  });

  it('handleRemoveFile should set fileToDelete, call openSheet, and open the ref', () => {
    const { result } = renderHook(() => useFileOperations(defaultProps));

    act(() => {
      result.current.handleRemoveFile('file-1');
    });

    expect(result.current.fileToDelete).toBe('file-1');
    expect(mockOpenSheet).toHaveBeenCalledWith('delete');
    expect(mockDeleteSheetRef.current.open).toHaveBeenCalledTimes(1);
  });

  it('confirmDeleteFile should filter files, reset state, and close sheet', () => {
    const { result } = renderHook(() => useFileOperations(defaultProps));

    // 1. Set the file to delete
    act(() => {
      result.current.handleRemoveFile('file-1');
    });

    expect(result.current.fileToDelete).toBe('file-1'); // Verify state is set

    // 2. Confirm the deletion
    act(() => {
      result.current.confirmDeleteFile();
    });

    // Check that setFiles was called with the correctly filtered array
    expect(mockSetFiles).toHaveBeenCalledWith([mockFile2]);
    // Check that state was reset
    expect(result.current.fileToDelete).toBeNull();
    // Check that the sheet was closed
    expect(mockCloseSheet).toHaveBeenCalledTimes(1);
  });

  it('confirmDeleteFile should not call setFiles if fileToDelete is null, but still close sheet', () => {
    const { result } = renderHook(() => useFileOperations(defaultProps));

    expect(result.current.fileToDelete).toBeNull(); // Verify initial state

    act(() => {
      result.current.confirmDeleteFile();
    });

    // setFiles should NOT have been called
    expect(mockSetFiles).not.toHaveBeenCalled();
    // State should remain null
    expect(result.current.fileToDelete).toBeNull();
    // closeSheet should STILL be called
    expect(mockCloseSheet).toHaveBeenCalledTimes(1);
  });

  it('handleRemoveFile should not crash if deleteSheetRef.current is null', () => {
    const { result } = renderHook(() => useFileOperations({
      ...defaultProps,
      deleteSheetRef: { current: null }, // Pass a null ref
    }));

    // This should not throw an error due to optional chaining
    expect(() => {
      act(() => {
        result.current.handleRemoveFile('file-1');
      });
    }).not.toThrow();

    // Should still set state and call openSheet
    expect(result.current.fileToDelete).toBe('file-1');
    expect(mockOpenSheet).toHaveBeenCalledWith('delete');
  });
});