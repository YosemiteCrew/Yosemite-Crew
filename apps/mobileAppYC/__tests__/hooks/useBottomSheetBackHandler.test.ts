import { renderHook, act } from '@testing-library/react-hooks';
import { useBottomSheetBackHandler } from '@/shared/hooks/useBottomSheetBackHandler'; // Adjust path if needed

// --- Mocks ---

// We'll store the listener callback here to trigger it manually
let mockBackHandlerListener: (() => boolean) | null = null;

// Mock the BackHandler module
const mockRemove = jest.fn();
const mockAddEventListener = jest.fn((event, cb) => {
  if (event === 'hardwareBackPress') {
    mockBackHandlerListener = cb;
  }
  return { remove: mockRemove };
});

jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  __esModule: true,
  default: {
    addEventListener: mockAddEventListener,
    removeEventListener: jest.fn(), // Not directly used by hook, but good practice
    exitApp: jest.fn(),
  },
}));

/**
 * Helper function to simulate firing the hardware back press.
 * Returns whatever the registered listener returned (true/false).
 */
const fireBackPress = (): boolean => {
  if (mockBackHandlerListener) {
    return mockBackHandlerListener();
  }
  return false;
};

// --- Test Suite ---

describe('useBottomSheetBackHandler', () => {
  // Reset mocks before each test
  beforeEach(() => {
    mockBackHandlerListener = null;
    mockAddEventListener.mockClear();
    mockRemove.mockClear();
  });

  it('should initialize with no sheet open', () => {
    const { result } = renderHook(() => useBottomSheetBackHandler());

    expect(result.current.openSheetKey).toBeNull();
    expect(result.current.isAnySheetOpen).toBe(false);
    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  it('should register a listener when a sheet is opened', () => {
    const { result } = renderHook(() => useBottomSheetBackHandler());

    act(() => {
      result.current.openSheet('sheet1');
    });

    expect(result.current.openSheetKey).toBe('sheet1');
    expect(result.current.isAnySheetOpen).toBe(true);
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockAddEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
  });

  it('should remove the listener when the sheet is closed', () => {
    const { result } = renderHook(() => useBottomSheetBackHandler());

    // Open sheet to add listener
    act(() => {
      result.current.openSheet('sheet1');
    });
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();

    // Close sheet to trigger cleanup
    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.openSheetKey).toBeNull();
    expect(result.current.isAnySheetOpen).toBe(false);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('should remove the listener when onSave is called', () => {
    const { result } = renderHook(() => useBottomSheetBackHandler());

    act(() => {
      result.current.openSheet('sheet1');
    });
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();

    act(() => {
      result.current.onSave();
    });

    expect(result.current.openSheetKey).toBeNull();
    expect(result.current.isAnySheetOpen).toBe(false);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('should remove the listener on unmount', () => {
    const { result, unmount } = renderHook(() => useBottomSheetBackHandler());

    act(() => {
      result.current.openSheet('sheet1');
    });
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);

    unmount();

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('should not register a listener if openSheetKey is null', () => {
    renderHook(() => useBottomSheetBackHandler());
    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  it('should call close() on the correct ref and return true on back press', () => {
    const mockSheet1Ref = { current: { close: jest.fn() } };
    const mockSheet2Ref = { current: { close: jest.fn() } };
    const { result } = renderHook(() => useBottomSheetBackHandler());

    act(() => {
      result.current.registerSheet('sheet1', mockSheet1Ref);
      result.current.registerSheet('sheet2', mockSheet2Ref);
    });

    act(() => {
      result.current.openSheet('sheet1');
    });

    // Fire the back press
    let handled = false;
    act(() => {
      handled = fireBackPress();
    });

    expect(handled).toBe(true); // Should prevent default action
    expect(mockSheet1Ref.current.close).toHaveBeenCalledTimes(1);
    expect(mockSheet2Ref.current.close).not.toHaveBeenCalled();
    expect(result.current.openSheetKey).toBeNull(); // State should be reset
    expect(result.current.isAnySheetOpen).toBe(false);
  });

  it('should return false if the open sheet has no registered ref', () => {
    const { result } = renderHook(() => useBottomSheetBackHandler());

    act(() => {
      result.current.openSheet('unregisteredSheet'); // No ref registered for this key
    });

    let handled = false;
    act(() => {
      handled = fireBackPress();
    });

    expect(handled).toBe(false); // Should not handle the back press
    expect(result.current.openSheetKey).toBe('unregisteredSheet'); // State not reset
  });

  it('should return false if the registered ref.current is null', () => {
    const mockSheetRef = { current: null }; // Ref exists, but current is null
    const { result } = renderHook(() => useBottomSheetBackHandler());

    act(() => {
      result.current.registerSheet('sheet1', mockSheetRef);
    });

    act(() => {
      result.current.openSheet('sheet1');
    });

    let handled = false;
    act(() => {
      handled = fireBackPress();
    });

    expect(handled).toBe(false); // Should not handle the back press
    expect(result.current.openSheetKey).toBe('sheet1'); // State not reset
  });

  it('should return false from listener if no sheet is open (listener somehow still active)', () => {
    const { result } = renderHook(() => useBottomSheetBackHandler());

    // Manually set up a listener (simulating a race condition)
    act(() => {
      result.current.openSheet('sheet1');
    });

    // Now close it
    act(() => {
      result.current.closeSheet();
    });

    // The real listener should have been removed, but we test the *logic*
    // of the captured listener from when it was open
    let handled = false;
    act(() => {
      // Note: In the real hook, the listener would be gone.
      // Here we assume it's still present and test its internal `if (openSheetKey)` check.
      // To test this properly, we test the state *before* firing.
      result.current.openSheet('sheet1'); // open
      const listener = mockBackHandlerListener; // capture listener
      result.current.closeSheet(); // close (openSheetKey is null)

      // Now fire the *captured* listener while state is null
      handled = listener ? listener() : false;
    });

    expect(handled).toBe(false);
  });
});