import { renderHook } from '@testing-library/react-hooks';
import { useFormBottomSheets } from '@/shared/hooks/useFormBottomSheets';
import { useBottomSheetBackHandler } from '@/shared/hooks/useBottomSheetBackHandler';

// Mock the dependency hook
jest.mock('@/shared/hooks/useBottomSheetBackHandler');

// Create mock functions to be returned by the mocked hook
const mockRegisterSheet = jest.fn();
const mockOpenSheet = jest.fn();
const mockCloseSheet = jest.fn();

// Type-cast the mock for easier use and to control its return value
const mockedUseBottomSheetBackHandler = useBottomSheetBackHandler as jest.Mock;

describe('useFormBottomSheets', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set the default mock implementation for the dependency hook
    mockedUseBottomSheetBackHandler.mockReturnValue({
      registerSheet: mockRegisterSheet,
      openSheet: mockOpenSheet,
      closeSheet: mockCloseSheet,
    });
  });

  it('should initialize all refs to null', () => {
    const { result } = renderHook(() => useFormBottomSheets());

    expect(result.current.refs.categorySheetRef.current).toBeNull();
    expect(result.current.refs.subcategorySheetRef.current).toBeNull();
    expect(result.current.refs.visitTypeSheetRef.current).toBeNull();
    expect(result.current.refs.uploadSheetRef.current).toBeNull();
    expect(result.current.refs.deleteSheetRef.current).toBeNull();
  });

  it('should call useBottomSheetBackHandler and return its functions', () => {
    const { result } = renderHook(() => useFormBottomSheets());

    // Check if the dependency hook was called
    expect(mockedUseBottomSheetBackHandler).toHaveBeenCalledTimes(1);

    // Check if the returned functions are the exact mock functions from the dependency
    expect(result.current.openSheet).toBe(mockOpenSheet);
    expect(result.current.closeSheet).toBe(mockCloseSheet);
  });

  it('should register all sheets via useEffect on initial render', () => {
    const { result } = renderHook(() => useFormBottomSheets());

    // useEffect should have run once on mount
    expect(mockRegisterSheet).toHaveBeenCalledTimes(5);

    // Verify each sheet was registered with the correct key and ref object
    expect(mockRegisterSheet).toHaveBeenCalledWith(
      'category',
      result.current.refs.categorySheetRef,
    );
    expect(mockRegisterSheet).toHaveBeenCalledWith(
      'subcategory',
      result.current.refs.subcategorySheetRef,
    );
    expect(mockRegisterSheet).toHaveBeenCalledWith(
      'visitType',
      result.current.refs.visitTypeSheetRef,
    );
    expect(mockRegisterSheet).toHaveBeenCalledWith(
      'upload',
      result.current.refs.uploadSheetRef,
    );
    expect(mockRegisterSheet).toHaveBeenCalledWith(
      'delete',
      result.current.refs.deleteSheetRef,
    );
  });

  it('should re-register sheets if registerSheet function identity changes', () => {
    const { rerender } = renderHook(() => useFormBottomSheets());

    // Initial render calls
    expect(mockRegisterSheet).toHaveBeenCalledTimes(5);

    // Create a new mock function to simulate a change in the dependency hook's return
    const newMockRegisterSheet = jest.fn();
    mockedUseBottomSheetBackHandler.mockReturnValue({
      registerSheet: newMockRegisterSheet, // Pass the new function
      openSheet: mockOpenSheet,
      closeSheet: mockCloseSheet,
    });

    // Rerender the hook
    rerender();

    // The old mock should not be called again
    expect(mockRegisterSheet).toHaveBeenCalledTimes(5);

    // The new mock should be called 5 times because the effect re-ran
    expect(newMockRegisterSheet).toHaveBeenCalledTimes(5);
  });
});