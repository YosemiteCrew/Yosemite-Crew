import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react-native';
import * as Redux from 'react-redux';
import * as Reanimated from 'react-native-reanimated';

import {mockTheme} from '../../../setup/mockTheme';
import {QRScannerScreen} from '../../../../src/features/linkedBusinesses/screens/QRScannerScreen';
import * as LinkedBusinessSelectors from '../../../../src/features/linkedBusinesses/selectors';

// --- Mocks ---

// Theme hook -> shared warm-bone mock theme (carries every warm-bone token the
// screen reads, e.g. theme.colors.cyan for the scan-line gradient).
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// The screen imports the loading selector directly from '../selectors' (not the
// barrel). Mock it so we can assert it is wired into useSelector.
jest.mock('../../../../src/features/linkedBusinesses/selectors', () => ({
  selectLinkedBusinessesLoading: jest.fn(),
}));

// react-native-reanimated + react-native-linear-gradient + Ionicons are all
// globally mocked in jest.setup.js. We only spy on the reanimated namespace to
// exercise both reduce-motion branches.

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockNavigate = jest.fn();

const createProps = (routeParams?: any) => ({
  navigation: {
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
    navigate: mockNavigate,
  } as any,
  route: {
    key: 'qr-scanner',
    name: 'QRScanner',
    params: routeParams,
  } as any,
});

const DEFAULT_SUBTITLE =
  "Linking shares your companion's record with this practice after you confirm.";

describe('QRScannerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // react-redux is not module-mocked here; spy on the live hook so the screen
    // renders without a Provider. Value is unused by the render.
    jest.spyOn(Redux, 'useSelector').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the camera scanner chrome with default (no-pet) copy', () => {
    render(<QRScannerScreen {...createProps()} />);

    // Header chrome
    expect(screen.getByText('Scan clinic code')).toBeTruthy();
    expect(screen.getByTestId('qr-scanner-close')).toBeTruthy();
    expect(screen.getByLabelText('Close scanner')).toBeTruthy();
    expect(screen.getByTestId('icon-close')).toBeTruthy();

    // Torch defaults to OFF
    expect(screen.getByLabelText('Turn on flashlight')).toBeTruthy();
    expect(screen.getByTestId('icon-flashlight-outline')).toBeTruthy();
    expect(
      screen.getByTestId('qr-scanner-torch').props.accessibilityState,
    ).toEqual({selected: false});

    // Viewfinder caption
    expect(
      screen.getByText('Point at the code on the front desk'),
    ).toBeTruthy();
    expect(screen.getByText(DEFAULT_SUBTITLE)).toBeTruthy();

    // Bottom controls
    expect(screen.getByTestId('qr-scanner-manual-entry')).toBeTruthy();
    expect(screen.getByText('Enter code manually')).toBeTruthy();
    expect(screen.getByTestId('icon-keypad-outline')).toBeTruthy();
    expect(screen.getByText('Codes look like YC-ALPN-2043')).toBeTruthy();
  });

  it('personalises the subtitle when a companion name is provided', () => {
    render(<QRScannerScreen {...createProps({companionName: 'Rex'})} />);

    expect(
      screen.getByText(
        "Linking shares Rex's record with this practice after you confirm.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(DEFAULT_SUBTITLE)).toBeNull();
  });

  it('falls back to the default subtitle when the companion name is whitespace', () => {
    render(<QRScannerScreen {...createProps({companionName: '   '})} />);

    expect(screen.getByText(DEFAULT_SUBTITLE)).toBeTruthy();
  });

  it('falls back to the default subtitle when params exist without a companion name', () => {
    render(<QRScannerScreen {...createProps({companionId: 'abc-123'})} />);

    expect(screen.getByText(DEFAULT_SUBTITLE)).toBeTruthy();
  });

  it('navigates back when there is history to pop', () => {
    mockCanGoBack.mockReturnValue(true);
    render(<QRScannerScreen {...createProps()} />);

    fireEvent.press(screen.getByTestId('qr-scanner-close'));

    expect(mockCanGoBack).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not navigate back when there is no history', () => {
    mockCanGoBack.mockReturnValue(false);
    render(<QRScannerScreen {...createProps()} />);

    fireEvent.press(screen.getByTestId('qr-scanner-close'));

    expect(mockCanGoBack).toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('toggles the torch, swapping the icon, label and a11y state', () => {
    render(<QRScannerScreen {...createProps()} />);

    const torchButton = screen.getByTestId('qr-scanner-torch');

    // OFF -> ON
    fireEvent.press(torchButton);
    expect(screen.getByLabelText('Turn off flashlight')).toBeTruthy();
    expect(screen.getByTestId('icon-flashlight')).toBeTruthy();
    expect(
      screen.getByTestId('qr-scanner-torch').props.accessibilityState,
    ).toEqual({selected: true});

    // ON -> OFF (exercises the toggle updater in both directions)
    fireEvent.press(screen.getByTestId('qr-scanner-torch'));
    expect(screen.getByLabelText('Turn on flashlight')).toBeTruthy();
    expect(screen.getByTestId('icon-flashlight-outline')).toBeTruthy();
    expect(
      screen.getByTestId('qr-scanner-torch').props.accessibilityState,
    ).toEqual({selected: false});
  });

  it('drops to the manual business-search flow, forwarding the route params', () => {
    const params = {companionName: 'Rex', companionId: 'abc-123'};
    render(<QRScannerScreen {...createProps(params)} />);

    fireEvent.press(screen.getByTestId('qr-scanner-manual-entry'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('BusinessSearch', params);
  });

  it('wires the linked-businesses loading selector into useSelector', () => {
    render(<QRScannerScreen {...createProps()} />);

    expect(Redux.useSelector).toHaveBeenCalledWith(
      LinkedBusinessSelectors.selectLinkedBusinessesLoading,
    );
  });

  it('starts the repeating scan-line sweep when reduce-motion is off', () => {
    const repeatSpy = jest.spyOn(Reanimated, 'withRepeat');

    render(<QRScannerScreen {...createProps()} />);

    // Default global mock: useReducedMotion() -> false, so the loop is armed.
    expect(repeatSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Scan clinic code')).toBeTruthy();
  });

  it('parks the scan-line and skips the loop when reduce-motion is on', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const repeatSpy = jest.spyOn(Reanimated, 'withRepeat');

    render(<QRScannerScreen {...createProps()} />);

    expect(repeatSpy).not.toHaveBeenCalled();
    // Screen still renders its static viewfinder.
    expect(screen.getByText('Scan clinic code')).toBeTruthy();
  });
});
