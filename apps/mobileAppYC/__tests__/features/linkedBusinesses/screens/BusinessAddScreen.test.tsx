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

// 3. Mock Thunks from index
// FIX: Added missing thunks to avoid "is not a function" errors
jest.mock('../../../../src/features/linkedBusinesses/index', () => ({
  addLinkedBusiness: jest.fn(),
  fetchBusinessDetails: jest.fn(),
  fetchGooglePlacesImage: jest.fn(),
  inviteBusiness: jest.fn(),
  linkBusiness: jest.fn(),
  selectLinkedBusinessesLoading: jest.fn(),
}));

// 4. Mock Hooks & Assets
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
        border: 'gray', // Added missing color used in styles
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

// 5. Mock Components
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

// 6. Mock Bottom Sheets with Ref forwarding
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

    // FIX: Setup default thunk implementations to return promises with .unwrap()
    const successResult = {unwrap: () => Promise.resolve({})};
    const imageResult = {
      unwrap: () => Promise.resolve({photoUrl: 'mock-photo'}),
    };

    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue(successResult);
    (
      LinkedBusinessActions.fetchGooglePlacesImage as unknown as jest.Mock
    ).mockReturnValue(imageResult);
    (
      LinkedBusinessActions.addLinkedBusiness as unknown as jest.Mock
    ).mockReturnValue(successResult);
    (
      LinkedBusinessActions.linkBusiness as unknown as jest.Mock
    ).mockReturnValue(successResult);
    (
      LinkedBusinessActions.inviteBusiness as unknown as jest.Mock
    ).mockReturnValue(successResult);
  });

  it('renders correctly for a PMS record', async () => {
    const props = createProps({isPMSRecord: true});
    render(<BusinessAddScreen {...props} />);

    // Wait for useEffect to fire
    await waitFor(() => {
      expect(LinkedBusinessActions.fetchGooglePlacesImage).toHaveBeenCalledWith(
        'place-123',
      );
    });

    expect(screen.getByText('Add')).toBeTruthy(); // Button title is "Add" when not loading
    expect(screen.getByText('Test Vet Clinic')).toBeTruthy();
    expect(screen.getByText(/We are happy to inform you/)).toBeTruthy();

    // Fetch details should NOT be called for PMS record
    expect(LinkedBusinessActions.fetchBusinessDetails).not.toHaveBeenCalled();
  });

  it('renders correctly for a non-PMS record', async () => {
    const props = createProps({isPMSRecord: false});
    render(<BusinessAddScreen {...props} />);

    // Wait for details fetch
    await waitFor(() => {
      expect(LinkedBusinessActions.fetchBusinessDetails).toHaveBeenCalledWith(
        'place-123',
      );
    });

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

  it('handles "Add" button press success flow', async () => {
    // Setup fetchBusinessDetails mock (implicit in beforeEach)
    const mockUnwrap = jest.fn().mockResolvedValue({});
    (
      LinkedBusinessActions.linkBusiness as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({isPMSRecord: true, organisationId: 'org-1'});
    render(<BusinessAddScreen {...props} />);

    // Press Add
    fireEvent.press(screen.getByTestId('btn-Add'));

    await waitFor(() => {
      expect(LinkedBusinessActions.linkBusiness).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId: 'comp-123',
          organisationId: 'org-1',
        }),
      );
    });

    await waitFor(() => {
      expect(mockAddSheetOpen).toHaveBeenCalled();
    });
  });

  it('handles "Add" button press failure', async () => {
    const mockUnwrap = jest.fn().mockRejectedValue(new Error('Add failed'));
    (
      LinkedBusinessActions.linkBusiness as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({isPMSRecord: true, organisationId: 'org-1'});
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

  it('handles closing the Add Business sheet', () => {
    const props = createProps({isPMSRecord: true});
    render(<BusinessAddScreen {...props} />);

    // Trigger open (manually or via flow) - we assume it's open for this interaction test
    // But we need to trigger the onConfirm prop passed to the sheet
    fireEvent.press(screen.getByTestId('add-sheet-confirm'));

    expect(mockAddSheetClose).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles "Notify Business" button press', async () => {
    const props = createProps({isPMSRecord: false});
    render(<BusinessAddScreen {...props} />);

    // Wait for initial fetch to complete so button is enabled
    await waitFor(() => {
      expect(LinkedBusinessActions.fetchBusinessDetails).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId('btn-Notify Business'));

    await waitFor(() => {
      expect(LinkedBusinessActions.inviteBusiness).toHaveBeenCalled();
      expect(mockNotifySheetOpen).toHaveBeenCalled();
    });
  });

  it('handles closing the Notify sheet (navigates back)', () => {
    const props = createProps({isPMSRecord: false});
    render(<BusinessAddScreen {...props} />);

    // Simulate onConfirm from NotifyBusinessBottomSheet
    fireEvent.press(screen.getByTestId('notify-sheet-confirm'));

    expect(mockNotifySheetClose).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles Header Back button press', () => {
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
