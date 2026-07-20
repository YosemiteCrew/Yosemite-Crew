import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  NetworkStatusBottomSheet,
  type NetworkStatusBottomSheetRef,
} from '../../../src/features/network/components/NetworkStatusBottomSheet';

// --- Mocks ---

// 1. Hooks — pin `useTheme` to the shared warm-bone mockTheme (the component
// only consumes `theme` from `@/hooks`). Matches sibling bottom-sheet tests.
jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

// 2. NetInfo
// The global setup mock exposes `addEventListener`/`fetch`/`useNetInfo` but
// omits both a `default` export and `refresh`, which this component reaches for
// via `import NetInfo from ...; NetInfo.refresh()`. Provide a focused mock.
jest.mock('@react-native-community/netinfo', () => {
  const refresh = jest.fn();
  return {
    __esModule: true,
    default: {
      refresh,
      fetch: jest.fn(() => Promise.resolve({isConnected: false})),
      addEventListener: jest.fn(() => jest.fn()),
      configure: jest.fn(),
    },
    refresh,
  };
});

// 3. CustomBottomSheet
// Render children inline, expose the imperative handle the component drives
// (`snapToIndex`/`close`), and capture `onChange` so the visibility bridge can
// be exercised from the test. Names are `mock`-prefixed per jest.mock rules.
const mockSnapToIndex = jest.fn();
const mockClose = jest.fn();
const mockOnChangeHolder: {current?: (index: number) => void} = {
  current: undefined,
};

jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const ReactLib = require('react');
  const {View: RNView} = require('react-native');

  const Mock = ReactLib.forwardRef(({children, onChange}: any, ref: any) => {
    mockOnChangeHolder.current = onChange;
    ReactLib.useImperativeHandle(ref, () => ({
      snapToIndex: mockSnapToIndex,
      close: mockClose,
    }));
    return <RNView testID="custom-bottom-sheet">{children}</RNView>;
  });
  Mock.displayName = 'CustomBottomSheet';
  return {__esModule: true, default: Mock};
});

describe('NetworkStatusBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnChangeHolder.current = undefined;
  });

  // ===========================================================================
  // 1. Rendering
  // ===========================================================================

  it('renders the inline banner and the full offline state copy', () => {
    const {getByText, getByTestId, getAllByTestId} = render(
      <NetworkStatusBottomSheet />,
    );

    expect(getByTestId('custom-bottom-sheet')).toBeTruthy();

    // Inline "degraded connection" banner
    expect(getByText('No connection · showing saved records')).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();

    // Full offline state
    expect(getByText("You're offline")).toBeTruthy();
    expect(
      getByText(
        "Your saved records still work. Booking, chat and sync will pick up where you left off once you're back.",
      ),
    ).toBeTruthy();
    expect(getByText('Try again')).toBeTruthy();
    expect(getByText('Open saved records')).toBeTruthy();

    // cloud-offline glyph appears twice (banner chip + medallion); refresh once
    expect(getAllByTestId('icon-cloud-offline-outline')).toHaveLength(2);
    expect(getByTestId('icon-refresh-outline')).toBeTruthy();

    // Action affordances carry their testIDs
    expect(getByTestId('network-offline-banner-retry')).toBeTruthy();
    expect(getByTestId('network-offline-retry')).toBeTruthy();
    expect(getByTestId('network-offline-open-saved')).toBeTruthy();
  });

  it('renders with an explicit bottomInset prop', () => {
    const {getByTestId} = render(<NetworkStatusBottomSheet bottomInset={24} />);
    expect(getByTestId('custom-bottom-sheet')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Retry handlers -> NetInfo.refresh
  // ===========================================================================

  it('refreshes connectivity when the inline banner "Retry" is pressed', () => {
    const {getByTestId} = render(<NetworkStatusBottomSheet />);

    fireEvent.press(getByTestId('network-offline-banner-retry'));

    expect(NetInfo.refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes connectivity when the primary "Try again" CTA is pressed', () => {
    const {getByTestId} = render(<NetworkStatusBottomSheet />);

    fireEvent.press(getByTestId('network-offline-retry'));

    expect(NetInfo.refresh).toHaveBeenCalledTimes(1);
  });

  // ===========================================================================
  // 3. closeSheet via the "Open saved records" link
  // ===========================================================================

  it('closes the sheet when "Open saved records" is pressed', () => {
    const {getByTestId} = render(<NetworkStatusBottomSheet />);

    fireEvent.press(getByTestId('network-offline-open-saved'));

    expect(mockClose).toHaveBeenCalledTimes(1);
    // Pressing the saved-records link should not trigger a connectivity refresh
    expect(NetInfo.refresh).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // 4. Imperative ref API
  // ===========================================================================

  it('opens via the imperative ref and snaps to the first index', () => {
    const ref = React.createRef<NetworkStatusBottomSheetRef>();
    render(<NetworkStatusBottomSheet ref={ref} />);

    act(() => {
      ref.current?.open();
    });

    expect(mockSnapToIndex).toHaveBeenCalledWith(0);
  });

  it('closes via the imperative ref', () => {
    const ref = React.createRef<NetworkStatusBottomSheetRef>();
    render(<NetworkStatusBottomSheet ref={ref} />);

    act(() => {
      ref.current?.close();
    });

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  // ===========================================================================
  // 5. onChange visibility bridge
  // ===========================================================================

  it('tracks sheet visibility through the onChange callback', () => {
    render(<NetworkStatusBottomSheet />);

    expect(mockOnChangeHolder.current).toBeInstanceOf(Function);

    // index 0 => visible, index -1 => hidden; both flows update state without
    // throwing and keep the sheet mounted.
    act(() => {
      mockOnChangeHolder.current?.(0);
    });
    act(() => {
      mockOnChangeHolder.current?.(-1);
    });
  });
});
