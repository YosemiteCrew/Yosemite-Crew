import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {QRScannerScreen} from '../../../../src/features/linkedBusinesses/screens/QRScannerScreen';
import * as Redux from 'react-redux';
import * as LinkedBusinessActions from '../../../../src/features/linkedBusinesses/index';

// --- Mocks ---

// 1. Mock Navigation
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();

const createProps = (params: any = {}) => ({
  navigation: {
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  } as any,
  route: {
    key: 'qr-scanner',
    name: 'QRScanner',
    params: undefined, // Screen has no params defined in type
    ...params,
  } as any,
});

// 2. Mock Redux
jest.spyOn(Redux, 'useSelector').mockReturnValue(false); // Default loading state

// 3. Mock Hooks & Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 4. Mock Components
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity onPress={onBack} testID="header-back">
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
}));

// Mock the specific selector from index to ensure it's recognized
jest.mock('../../../../src/features/linkedBusinesses/index', () => ({
  selectLinkedBusinessesLoading: jest.fn(),
}));

describe('QRScannerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the scanner UI correctly', () => {
    const props = createProps();
    render(<QRScannerScreen {...props} />);

    // Check Header
    expect(screen.getByText('Scan QR Code')).toBeTruthy();

    // Check Scanner Placeholder elements
    expect(screen.getByText('QR Code Scanner')).toBeTruthy();
    expect(
      screen.getByText('Point your camera at the QR code to scan it'),
    ).toBeTruthy();

    // Check Mock Button/Hint area
    expect(screen.getByText('Mock QR Scanner')).toBeTruthy();
    expect(screen.getByText(/Available integration/)).toBeTruthy();
  });

  it('handles back navigation when history exists', () => {
    mockCanGoBack.mockReturnValue(true);
    const props = createProps();
    render(<QRScannerScreen {...props} />);

    const backBtn = screen.getByTestId('header-back');
    fireEvent.press(backBtn);

    expect(mockCanGoBack).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('does not navigate back if history is empty', () => {
    mockCanGoBack.mockReturnValue(false);
    const props = createProps();
    render(<QRScannerScreen {...props} />);

    const backBtn = screen.getByTestId('header-back');
    fireEvent.press(backBtn);

    expect(mockCanGoBack).toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('calls the loading selector', () => {
    // The component calls useSelector(selectLinkedBusinessesLoading)
    // even though it doesn't strictly use the return value in the render.
    // We verify this side effect ensures the selector is hooked up.
    const props = createProps();
    render(<QRScannerScreen {...props} />);

    expect(Redux.useSelector).toHaveBeenCalledWith(
      LinkedBusinessActions.selectLinkedBusinessesLoading,
    );
  });
});
