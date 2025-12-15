import { renderHook, act } from '@testing-library/react-native';
import React from 'react';
import useConfirmActionSheetRef from '../../src/shared/hooks/useConfirmActionSheetRef';

describe('useConfirmActionSheetRef', () => {
  it('exposes open and close methods via the passed parent ref', () => {
    // 1. Create a ref object to pass in (simulating a parent component's ref)
    const parentRef = React.createRef<{ open: () => void; close: () => void }>();

    const { result } = renderHook(() => useConfirmActionSheetRef(parentRef));

    // 2. Mock the internal sheet behavior
    const mockSheetOpen = jest.fn();
    const mockSheetClose = jest.fn();

    // Manually populate the internal ref that the hook created
    // (This mimics the BottomSheet component attaching itself to the ref)
    // @ts-ignore - Partial mock
    result.current.sheetRef.current = {
      open: mockSheetOpen,
      close: mockSheetClose,
    };

    // 3. Trigger methods on the PARENT ref
    act(() => {
      parentRef.current?.open();
    });
    expect(mockSheetOpen).toHaveBeenCalledTimes(1);

    act(() => {
      parentRef.current?.close();
    });
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('handleConfirm closes the sheet and calls the onConfirm callback', () => {
    const parentRef = React.createRef<any>();
    const mockOnConfirm = jest.fn();

    const { result } = renderHook(() =>
      useConfirmActionSheetRef(parentRef, mockOnConfirm)
    );

    const mockSheetClose = jest.fn();
    // @ts-ignore - Partial mock
    result.current.sheetRef.current = {
      close: mockSheetClose,
    };

    // Trigger the handler returned by the hook
    act(() => {
      result.current.handleConfirm();
    });

    expect(mockSheetClose).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('handles missing sheetRef safely (optional chaining check)', () => {
    const parentRef = React.createRef<{ open: () => void; close: () => void }>();

    // Initialize hook (sheetRef.current starts as null)
    const { result } = renderHook(() => useConfirmActionSheetRef(parentRef));

    expect(result.current.sheetRef.current).toBeNull();

    // Call parent methods - should not crash
    act(() => {
      parentRef.current?.open();
      parentRef.current?.close();
    });

    // Call confirm handler - should not crash
    act(() => {
      result.current.handleConfirm();
    });

    // If we reached here without throwing, the test passes
    expect(true).toBe(true);
  });

  it('handles missing onConfirm callback safely', () => {
    const parentRef = React.createRef<any>();

    // Initialize without onConfirm prop
    const { result } = renderHook(() => useConfirmActionSheetRef(parentRef));

    const mockSheetClose = jest.fn();
    // @ts-ignore
    result.current.sheetRef.current = {
      close: mockSheetClose,
    };

    act(() => {
      result.current.handleConfirm();
    });

    // Should still close sheet, but ignore the missing callback
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });
});