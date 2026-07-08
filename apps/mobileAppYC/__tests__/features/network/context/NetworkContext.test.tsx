import React from 'react';
import {renderHook, act} from '@testing-library/react-native';
import {
  NetworkProvider,
  useNetworkStatus,
} from '@/features/network/context/NetworkContext';

const mockUseNetInfo = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => mockUseNetInfo(),
}));

describe('NetworkContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNetInfo.mockReturnValue({isConnected: true});
  });

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <NetworkProvider>{children}</NetworkProvider>
  );

  it('throws when used outside of a NetworkProvider', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => renderHook(() => useNetworkStatus())).toThrow(
      'useNetworkStatus must be used within NetworkProvider',
    );

    consoleErrorSpy.mockRestore();
  });

  it('reports isOnline true when NetInfo reports connected', () => {
    mockUseNetInfo.mockReturnValue({isConnected: true});
    const {result} = renderHook(() => useNetworkStatus(), {wrapper});

    expect(result.current.isOnline).toBe(true);
  });

  it('reports isOnline false when NetInfo reports disconnected', () => {
    mockUseNetInfo.mockReturnValue({isConnected: false});
    const {result} = renderHook(() => useNetworkStatus(), {wrapper});

    expect(result.current.isOnline).toBe(false);
  });

  it('defaults isOnline to true when NetInfo reports an unknown connection state', () => {
    mockUseNetInfo.mockReturnValue({isConnected: null});
    const {result} = renderHook(() => useNetworkStatus(), {wrapper});

    expect(result.current.isOnline).toBe(true);
  });

  it('starts with a null sheetRef and stores it via setNetworkSheetRef', () => {
    const {result} = renderHook(() => useNetworkStatus(), {wrapper});

    expect(result.current.sheetRef).toBeNull();

    const sheetHandle = {open: jest.fn(), close: jest.fn()};
    const ref = {current: sheetHandle};
    act(() => {
      result.current.setNetworkSheetRef(ref);
    });

    expect(result.current.sheetRef).toBe(ref);
  });

  it('opens the network sheet when connectivity is lost', () => {
    mockUseNetInfo.mockReturnValue({isConnected: true});
    const {result, rerender} = renderHook(() => useNetworkStatus(), {
      wrapper,
    });

    const sheetHandle = {open: jest.fn(), close: jest.fn()};
    act(() => {
      result.current.setNetworkSheetRef({current: sheetHandle});
    });
    sheetHandle.close.mockClear();

    mockUseNetInfo.mockReturnValue({isConnected: false});
    act(() => {
      rerender({});
    });

    expect(sheetHandle.open).toHaveBeenCalled();
    expect(sheetHandle.close).not.toHaveBeenCalled();
  });

  it('closes the network sheet when connectivity is restored', () => {
    mockUseNetInfo.mockReturnValue({isConnected: false});
    const {result, rerender} = renderHook(() => useNetworkStatus(), {
      wrapper,
    });

    const sheetHandle = {open: jest.fn(), close: jest.fn()};
    act(() => {
      result.current.setNetworkSheetRef({current: sheetHandle});
    });

    mockUseNetInfo.mockReturnValue({isConnected: true});
    act(() => {
      rerender({});
    });

    expect(sheetHandle.close).toHaveBeenCalled();
  });

  it('does nothing when the sheet ref has no current handle', () => {
    mockUseNetInfo.mockReturnValue({isConnected: true});
    const {rerender} = renderHook(() => useNetworkStatus(), {wrapper});

    mockUseNetInfo.mockReturnValue({isConnected: false});
    // No sheetRef was ever set, so the effect should safely no-op.
    expect(() =>
      act(() => {
        rerender({});
      }),
    ).not.toThrow();
  });
});
