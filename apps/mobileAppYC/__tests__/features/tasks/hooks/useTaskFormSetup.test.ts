import {renderHook, act} from '@testing-library/react-native';
// Path: 4 levels up to project root
import {useTaskFormSetup} from '../../../../src/features/tasks/hooks/useTaskFormSetup';
import * as Hooks from '@/hooks';

// --- Mocks ---
jest.mock('@/hooks', () => ({
  useTaskFormState: jest.fn(),
  useFormBottomSheets: jest.fn(),
  useTaskFormSheets: jest.fn(),
  useFileOperations: jest.fn(),
}));

describe('useTaskFormSetup', () => {
  // Mock return values for sub-hooks
  const mockTaskFormState = {
    formData: { attachments: ['file1'] },
    updateField: jest.fn(),
    clearError: jest.fn(),
    hasUnsavedChanges: false,
  };

  const mockFormBottomSheets = {
    refs: {
      uploadSheetRef: 'mock-upload-ref',
      deleteSheetRef: 'mock-form-delete-ref',
    },
    openSheet: jest.fn(),
    closeSheet: jest.fn(),
  };

  const mockTaskFormSheets = {
    openTaskSheet: jest.fn(),
    closeTaskSheet: jest.fn(),
    medicationTypeSheetRef: 'mock-med-ref',
    // ... other refs would be here
  };

  const mockFileOperations = {
    handleRemoveFile: jest.fn(),
    handleUpload: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (Hooks.useTaskFormState as jest.Mock).mockReturnValue(mockTaskFormState);
    (Hooks.useFormBottomSheets as jest.Mock).mockReturnValue(mockFormBottomSheets);
    (Hooks.useTaskFormSheets as jest.Mock).mockReturnValue(mockTaskFormSheets);
    (Hooks.useFileOperations as jest.Mock).mockReturnValue(mockFileOperations);
  });

  it('initializes and returns consolidated hook data', () => {
    const { result } = renderHook(() => useTaskFormSetup());

    // Verify composition of return object
    expect(result.current).toEqual(expect.objectContaining({
      ...mockTaskFormState,
      ...mockFileOperations,
      uploadSheetRef: mockFormBottomSheets.refs.uploadSheetRef,
      deleteSheetRef: mockFormBottomSheets.refs.deleteSheetRef,
      openSheet: mockFormBottomSheets.openSheet,
      closeSheet: mockFormBottomSheets.closeSheet,
      openTaskSheet: mockTaskFormSheets.openTaskSheet,
      closeTaskSheet: mockTaskFormSheets.closeTaskSheet,
      medicationTypeSheetRef: mockTaskFormSheets.medicationTypeSheetRef,
    }));
  });

  it('correctly wires up file operations callbacks to form state', () => {
    renderHook(() => useTaskFormSetup());

    // Verify useFileOperations was called with the right configuration
    expect(Hooks.useFileOperations).toHaveBeenCalledWith(expect.objectContaining({
      files: mockTaskFormState.formData.attachments,
      openSheet: mockFormBottomSheets.openSheet,
      closeSheet: mockFormBottomSheets.closeSheet,
      deleteSheetRef: mockFormBottomSheets.refs.deleteSheetRef,
    }));

    // Extract the configuration object passed to useFileOperations to test the callbacks
    const config = (Hooks.useFileOperations as jest.Mock).mock.calls[0][0];

    // Test setFiles callback
    const newFiles = ['file1', 'file2'];
    act(() => {
        config.setFiles(newFiles);
    });
    expect(mockTaskFormState.updateField).toHaveBeenCalledWith('attachments', newFiles);

    // Test clearError callback
    act(() => {
        config.clearError();
    });
    expect(mockTaskFormState.clearError).toHaveBeenCalledWith('attachments');
  });
});