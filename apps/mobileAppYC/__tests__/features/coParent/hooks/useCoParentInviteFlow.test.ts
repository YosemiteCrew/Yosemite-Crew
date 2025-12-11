import {renderHook, act} from '@testing-library/react-native';
import {useCoParentInviteFlow} from '../../../../src/features/coParent/hooks/useCoParentInviteFlow';

describe('useCoParentInviteFlow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const mockSheet = {
    open: jest.fn(),
    close: jest.fn(),
  };

  it('returns all refs and handlers', () => {
    const {result} = renderHook(() => useCoParentInviteFlow());

    expect(result.current.addCoParentSheetRef).toBeDefined();
    expect(result.current.coParentInviteSheetRef).toBeDefined();
    expect(typeof result.current.openAddCoParentSheet).toBe('function');
    expect(typeof result.current.handleAddCoParentClose).toBe('function');
    expect(typeof result.current.handleInviteAccept).toBe('function');
    expect(typeof result.current.handleInviteDecline).toBe('function');
  });

  describe('openAddCoParentSheet', () => {
    it('opens the add co-parent sheet if ref is current', () => {
      const {result} = renderHook(() => useCoParentInviteFlow());

      // Simulate ref assignment
      // @ts-ignore - Writing to readonly ref for test simulation
      result.current.addCoParentSheetRef.current = mockSheet;

      act(() => {
        result.current.openAddCoParentSheet();
      });

      expect(mockSheet.open).toHaveBeenCalledTimes(1);
    });

    it('does not crash if ref is null (Branch coverage)', () => {
      const {result} = renderHook(() => useCoParentInviteFlow());

      // Ensure ref is null
      // @ts-ignore
      result.current.addCoParentSheetRef.current = null;

      act(() => {
        result.current.openAddCoParentSheet();
      });

      // No error should be thrown
    });
  });

  describe('handleAddCoParentClose', () => {
    it('closes add sheet and opens invite sheet after delay', () => {
      const {result} = renderHook(() => useCoParentInviteFlow());

      const mockAddSheet = { close: jest.fn() };
      const mockInviteSheet = { open: jest.fn() };

      // @ts-ignore
      result.current.addCoParentSheetRef.current = mockAddSheet;
      // @ts-ignore
      result.current.coParentInviteSheetRef.current = mockInviteSheet;

      act(() => {
        result.current.handleAddCoParentClose();
      });

      // Immediate check: Close first sheet
      expect(mockAddSheet.close).toHaveBeenCalledTimes(1);
      expect(mockInviteSheet.open).not.toHaveBeenCalled();

      // Fast forward time
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Delayed check: Open second sheet
      expect(mockInviteSheet.open).toHaveBeenCalledTimes(1);
    });

    it('safely handles null refs during transition (Branch coverage)', () => {
      const {result} = renderHook(() => useCoParentInviteFlow());

      // @ts-ignore
      result.current.addCoParentSheetRef.current = null;
      // @ts-ignore
      result.current.coParentInviteSheetRef.current = null;

      act(() => {
        result.current.handleAddCoParentClose();
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // No errors
    });
  });

  describe('handleInviteAccept', () => {
    it('closes invite sheet and calls callback', () => {
      const onInviteComplete = jest.fn();
      const {result} = renderHook(() => useCoParentInviteFlow({ onInviteComplete }));

      // @ts-ignore
      result.current.coParentInviteSheetRef.current = mockSheet;

      act(() => {
        result.current.handleInviteAccept();
      });

      expect(mockSheet.close).toHaveBeenCalledTimes(1);
      expect(onInviteComplete).toHaveBeenCalledTimes(1);
    });

    it('safely handles null ref and undefined callback (Branch coverage)', () => {
      const {result} = renderHook(() => useCoParentInviteFlow()); // No callback provided

      // @ts-ignore
      result.current.coParentInviteSheetRef.current = null;

      act(() => {
        result.current.handleInviteAccept();
      });

      // Should not crash
    });
  });

  describe('handleInviteDecline', () => {
    it('closes invite sheet and calls callback', () => {
      const onInviteComplete = jest.fn();
      const {result} = renderHook(() => useCoParentInviteFlow({ onInviteComplete }));

      // @ts-ignore
      result.current.coParentInviteSheetRef.current = mockSheet;

      act(() => {
        result.current.handleInviteDecline();
      });

      expect(mockSheet.close).toHaveBeenCalledTimes(1);
      expect(onInviteComplete).toHaveBeenCalledTimes(1);
    });

    it('safely handles null ref and undefined callback (Branch coverage)', () => {
      const {result} = renderHook(() => useCoParentInviteFlow());

      // @ts-ignore
      result.current.coParentInviteSheetRef.current = null;

      act(() => {
        result.current.handleInviteDecline();
      });

      // Should not crash
    });
  });
});