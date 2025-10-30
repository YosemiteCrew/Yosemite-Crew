import { renderHook } from '@testing-library/react-hooks';
import { useFormBottomSheets } from '@/shared/hooks/useFormBottomSheets';
import { useBottomSheetBackHandler } from '@/shared/hooks/useBottomSheetBackHandler';


// Mock the dependency hook
jest.mock('@/shared/hooks/useBottomSheetBackHandler');

const mockRegisterSheet = jest.fn();
const mockOpenSheet = jest.fn();
const mockCloseSheet = jest.fn();

const mockedUseBottomSheetBackHandler = useBottomSheetBackHandler as jest.Mock;

describe('useFormBottomSheets', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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

    expect(mockedUseBottomSheetBackHandler).toHaveBeenCalledTimes(1);
    expect(result.current.openSheet).toBe(mockOpenSheet);
    expect(result.current.closeSheet).toBe(mockCloseSheet);
  });

  it('should register all sheets via useEffect on initial render', () => {
    const { result } = renderHook(() => useFormBottomSheets());

    expect(mockRegisterSheet).toHaveBeenCalledTimes(5);

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

    expect(mockRegisterSheet).toHaveBeenCalledTimes(5);

    const newMockRegisterSheet = jest.fn();
    mockedUseBottomSheetBackHandler.mockReturnValue({
      registerSheet: newMockRegisterSheet,
      openSheet: mockOpenSheet,
      closeSheet: mockCloseSheet,
    });

    rerender();

    expect(mockRegisterSheet).toHaveBeenCalledTimes(5);

    expect(newMockRegisterSheet).toHaveBeenCalledTimes(5);
  });
});