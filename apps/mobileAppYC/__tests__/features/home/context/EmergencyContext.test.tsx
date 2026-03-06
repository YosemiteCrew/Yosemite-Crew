import React from 'react';
import {Text} from 'react-native';
import {render, renderHook, act} from '@testing-library/react-native';
import {
  EmergencyProvider,
  useEmergency,
} from '../../../../src/features/home/context/EmergencyContext';

describe('EmergencyContext', () => {
  // --- 1. Error Handling ---

  it('throws an error if useEmergency is used outside of EmergencyProvider', () => {
    // Hide console.error to keep test output clean, as React logs the error boundary content
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      renderHook(() => useEmergency());
    }).toThrow('useEmergency must be used within EmergencyProvider');

    consoleSpy.mockRestore();
  });

  // --- 2. Basic Rendering ---

  it('renders children correctly when wrapped in EmergencyProvider', () => {
    const {getByText} = render(
      <EmergencyProvider>
        <Text>Child Content</Text>
      </EmergencyProvider>,
    );

    expect(getByText('Child Content')).toBeTruthy();
  });

  // --- 3. Hook Methods & Ref Logic ---

  it('provides methods that invoke the underlying ref methods', () => {
    const mockOpen = jest.fn();
    const mockClose = jest.fn();

    const {result} = renderHook(() => useEmergency(), {
      wrapper: EmergencyProvider,
    });

    // Create a mock ref object that matches the expected shape
    const mockRefObject = {
      current: {
        open: mockOpen,
        close: mockClose,
      },
    };

    // 1. Set the ref
    act(() => {
      result.current.setEmergencySheetRef(mockRefObject as any);
    });

    // 2. Test Open
    act(() => {
      result.current.openEmergencySheet();
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);

    // 3. Test Close
    act(() => {
      result.current.closeEmergencySheet();
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  // --- 4. Branch Coverage (Null Safety) ---

  it('does not crash if open/close are called before ref is set (null checks)', () => {
    const {result} = renderHook(() => useEmergency(), {
      wrapper: EmergencyProvider,
    });

    // The ref is null initially by default in the Provider

    // Call Open - Should strictly not crash
    expect(() => {
      act(() => {
        result.current.openEmergencySheet();
      });
    }).not.toThrow();

    // Call Close - Should strictly not crash
    expect(() => {
      act(() => {
        result.current.closeEmergencySheet();
      });
    }).not.toThrow();
  });
});
