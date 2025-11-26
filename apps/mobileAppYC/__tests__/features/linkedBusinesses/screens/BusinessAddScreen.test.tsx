import React from 'react';
import {
  render,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {BusinessAddScreen} from '../../../../src/features/linkedBusinesses/screens/BusinessAddScreen';
import * as Redux from 'react-redux';
import * as LinkedBusinessActions from '../../../../src/features/linkedBusinesses/index';
import {Alert} from 'react-native';

// --- Mocks ---

// 1. Mock Navigation
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

const createProps = (params: any = {}) => ({
  navigation: {
    goBack: mockGoBack,
    navigate: mockNavigate,
    canGoBack: mockCanGoBack,
  } as any,
  route: {
    key: 'test-key',
    name: 'BusinessAdd',
    params: {
      companionId: 'comp-123',
      category: 'Vet',
      businessId: 'biz-123',
      businessName: 'Test Vet Clinic',
      businessAddress: '123 Pet St',
      phone: '555-0123',
      email: 'contact@vet.com',
      isPMSRecord: true, // Default to PMS record
      rating: 4.5,
      distance: 1.2,
      placeId: 'place-123',
      companionName: 'Buddy',
      ...params,
    },
  } as any,
});

// 2. Mock Redux
const mockDispatch = jest.fn(action => action);
jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
jest.spyOn(Redux, 'useSelector').mockReturnValue(false); // Default loading state

// Mock Thunks from index
jest.mock('../../../../src/features/linkedBusinesses/index', () => ({
  addLinkedBusiness: jest.fn(),
  fetchBusinessDetails: jest.fn(),
  selectLinkedBusinessesLoading: jest.fn(),
}));

// 3. Mock Hooks & Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        text: 'black',
        secondary: 'blue',
        borderMuted: 'gray',
        cardBackground: 'white',
        white: 'white',
      },
      spacing: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48],
      borderRadius: {lg: 12},
      typography: {
        captionBoldSatoshi: {fontSize: 12},
        cta: {fontSize: 14},
      },
    },
  }),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    yosemiteLogo: {uri: 'logo'},
  },
}));

// 4. Mock Components
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {TouchableOpacity, Text, View} = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity onPress={onBack} testID="header-back">
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, disabled}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          onPress={onPress}
          disabled={disabled}
          testID={`btn-${title}`}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock(
  '@/features/appointments/components/VetBusinessCard/VetBusinessCard',
  () => ({
    VetBusinessCard: (props: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID="vet-business-card">
          <Text>{props.name}</Text>
          <Text>{props.phone}</Text>
        </View>
      );
    },
  }),
);

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => {
    const {View} = require('react-native');
    return <View testID="liquid-glass-card">{children}</View>;
  },
}));

// 5. Mock Bottom Sheets with Ref forwarding
const mockAddSheetOpen = jest.fn();
const mockAddSheetClose = jest.fn();
const mockNotifySheetOpen = jest.fn();
const mockNotifySheetClose = jest.fn();

jest.mock(
  '../../../../src/features/linkedBusinesses/components/AddBusinessBottomSheet',
  () => ({
    // Use IIFE to require React inside factory
    AddBusinessBottomSheet: (function () {
      const React = require('react');
      const {View, Text, TouchableOpacity} = require('react-native');

      return React.forwardRef((props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          open: mockAddSheetOpen,
          close: mockAddSheetClose,
        }));
        // Render confirm button to test callback
        return (
          <View testID="add-business-sheet">
            <TouchableOpacity
              onPress={props.onConfirm}
              testID="add-sheet-confirm">
              <Text>Confirm Add</Text>
            </TouchableOpacity>
          </View>
        );
      });
    })(),
  }),
);

jest.mock(
  '../../../../src/features/linkedBusinesses/components/NotifyBusinessBottomSheet',
  () => ({
    // Use IIFE to require React inside factory
    NotifyBusinessBottomSheet: (function () {
      const React = require('react');
      const {View, Text, TouchableOpacity} = require('react-native');

      return React.forwardRef((props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          open: mockNotifySheetOpen,
          close: mockNotifySheetClose,
        }));
        // Render confirm button to test callback
        return (
          <View testID="notify-business-sheet">
            <TouchableOpacity
              onPress={props.onConfirm}
              testID="notify-sheet-confirm">
              <Text>Confirm Notify</Text>
            </TouchableOpacity>
          </View>
        );
      });
    })(),
  }),
);

// Spy on Alert
jest.spyOn(Alert, 'alert');

describe('BusinessAddScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly for a PMS record', () => {
    // Mock for useEffect fetch (should not run for PMS)
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    const props = createProps({isPMSRecord: true});
    render(<BusinessAddScreen {...props} />);

    expect(screen.getByText('Add Business')).toBeTruthy();
    expect(screen.getByText('Test Vet Clinic')).toBeTruthy();
    expect(screen.getByText(/We are happy to inform you/)).toBeTruthy();
    expect(screen.getByTestId('btn-Add')).toBeTruthy();

    // Fetch details should NOT be called for PMS record
    expect(LinkedBusinessActions.fetchBusinessDetails).not.toHaveBeenCalled();
  });

  it('renders correctly for a non-PMS record', () => {
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    const props = createProps({isPMSRecord: false});
    render(<BusinessAddScreen {...props} />);

    expect(screen.getByText(/We are sorry to inform you/)).toBeTruthy();
    expect(screen.getByTestId('btn-Notify Business')).toBeTruthy();
  });

  it('fetches business details for non-PMS records on mount success', async () => {
    const mockUnwrap = jest.fn().mockResolvedValue({
      photoUrl: 'new-photo-url',
      phoneNumber: '999-9999',
      website: 'new.com',
    });
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({isPMSRecord: false, placeId: 'place-1'});
    render(<BusinessAddScreen {...props} />);

    expect(mockDispatch).toHaveBeenCalled();
    expect(LinkedBusinessActions.fetchBusinessDetails).toHaveBeenCalledWith(
      'place-1',
    );

    // Wait for promises to resolve
    await waitFor(() => {
      expect(mockUnwrap).toHaveBeenCalled();
    });
  });

  it('fetches business details but handles missing fields (branches)', async () => {
    const mockUnwrap = jest.fn().mockResolvedValue({}); // Empty object
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({isPMSRecord: false, placeId: 'place-1'});
    render(<BusinessAddScreen {...props} />);

    await waitFor(() => {
      expect(mockUnwrap).toHaveBeenCalled();
    });
    // Assertions here implicitly check that the "if (result.photoUrl)" etc. branches didn't crash when false
  });

  it('handles fetch details failure gracefully', async () => {
    const mockUnwrap = jest.fn().mockRejectedValue(new Error('Fetch failed'));
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({isPMSRecord: false, placeId: 'place-1'});
    render(<BusinessAddScreen {...props} />);

    await waitFor(() => {
      expect(mockUnwrap).toHaveBeenCalled();
    });
    // Should still be rendered and usable
    expect(screen.getByTestId('btn-Notify Business')).toBeTruthy();
  });

  it('does NOT fetch details if placeId is missing for non-PMS record', () => {
    const props = createProps({isPMSRecord: false, placeId: undefined});
    render(<BusinessAddScreen {...props} />);

    expect(LinkedBusinessActions.fetchBusinessDetails).not.toHaveBeenCalled();
  });

  it('handles "Add" button press success flow', async () => {
    // Setup fetchBusinessDetails mock
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    const mockUnwrap = jest.fn().mockResolvedValue({});
    (
      LinkedBusinessActions.addLinkedBusiness as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({isPMSRecord: true});
    render(<BusinessAddScreen {...props} />);

    // Press Add
    fireEvent.press(screen.getByTestId('btn-Add'));

    expect(LinkedBusinessActions.addLinkedBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Test Vet Clinic',
        companionId: 'comp-123',
      }),
    );

    await waitFor(() => {
      expect(mockAddSheetOpen).toHaveBeenCalled();
    });
  });

  it('handles "Add" button press success flow with missing optional params', async () => {
    // This tests the fallback logic detailedPhone || phone when defaults are undefined
    const mockUnwrap = jest.fn().mockResolvedValue({});
    (
      LinkedBusinessActions.addLinkedBusiness as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({
      isPMSRecord: true,
      phone: undefined,
      email: undefined,
      photo: undefined,
    });
    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('btn-Add'));

    expect(LinkedBusinessActions.addLinkedBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: undefined,
        email: undefined,
        photo: undefined,
      }),
    );
  });

  it('handles "Add" button press failure', async () => {
    const mockUnwrap = jest.fn().mockRejectedValue(new Error('Add failed'));
    (
      LinkedBusinessActions.addLinkedBusiness as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({isPMSRecord: true});
    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('btn-Add'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to add business'),
      );
    });

    expect(mockAddSheetOpen).not.toHaveBeenCalled();
  });

  it('handles closing the Add Business sheet (opens Notify sheet)', () => {
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    const props = createProps({isPMSRecord: true});
    render(<BusinessAddScreen {...props} />);

    // Simulate the onConfirm callback from the AddBusinessBottomSheet
    fireEvent.press(screen.getByTestId('add-sheet-confirm'));

    expect(mockAddSheetClose).toHaveBeenCalled();
    expect(mockNotifySheetOpen).toHaveBeenCalled();
  });

  it('handles "Notify Business" button press', async () => {
    // Mock fetch to resolve immediately
    const mockUnwrap = jest.fn().mockResolvedValue({});
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({isPMSRecord: false});
    render(<BusinessAddScreen {...props} />);

    // Wait for initial fetch to complete so button is enabled
    await waitFor(() => {
      expect(mockUnwrap).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId('btn-Notify Business'));
  });

  it('handles closing the Notify sheet (navigates back)', () => {
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    const props = createProps({isPMSRecord: false});
    render(<BusinessAddScreen {...props} />);

    // Simulate onConfirm from NotifyBusinessBottomSheet
    fireEvent.press(screen.getByTestId('notify-sheet-confirm'));

    expect(mockNotifySheetClose).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles Header Back button press', () => {
    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    const props = createProps();
    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('does not go back if navigation history is empty', () => {
    const mockCanGoBackFalse = jest.fn().mockReturnValue(false);
    const props = createProps();
    props.navigation.canGoBack = mockCanGoBackFalse;

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
