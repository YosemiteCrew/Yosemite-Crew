import React from 'react';
import {mockTheme} from '../../../setup/mockTheme';
import {
  render,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {BusinessAddScreen} from '../../../../src/features/linkedBusinesses/screens/BusinessAddScreen';
import * as Redux from 'react-redux';
import * as LinkedBusinessActions from '../../../../src/features/linkedBusinesses/thunks';
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
      placeId: undefined,
      companionName: 'Buddy',
      ...params,
    },
  } as any,
});

// 2. Mock Redux
const mockDispatch = jest.fn(action => action);
jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
jest.spyOn(Redux, 'useSelector').mockReturnValue(false); // Default loading state

// 3. Mock direct thunk imports used by BusinessAddScreen
jest.mock('../../../../src/features/linkedBusinesses/thunks', () => ({
  addLinkedBusiness: jest.fn(),
  fetchBusinessDetails: jest.fn(),
  fetchGooglePlacesImage: jest.fn(),
  inviteBusiness: jest.fn(),
  linkBusiness: jest.fn(),
}));

// 4. Mock Hooks & Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
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
      // FIX: Alias React to avoid shadowing
      const ReactMock = require('react');
      const {View, Text, TouchableOpacity} = require('react-native');

      return ReactMock.forwardRef((props: any, ref: any) => {
        ReactMock.useImperativeHandle(ref, () => ({
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
      // FIX: Alias React to avoid shadowing
      const ReactMock = require('react');
      const {View, Text, TouchableOpacity} = require('react-native');

      return ReactMock.forwardRef((props: any, ref: any) => {
        ReactMock.useImperativeHandle(ref, () => ({
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
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks wipes call data but not implementations; re-assert the
    // default loading=false so a prior loading=true test cannot leak forward.
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(false);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Setup default thunk implementations to return promises with .unwrap().
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

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('renders correctly for a PMS record', async () => {
    const props = createProps({isPMSRecord: true, placeId: 'place-123'});
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
    const props = createProps({isPMSRecord: false, placeId: 'place-123'});
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
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    try {
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to add business:',
        expect.any(Error),
      );
      expect(mockAddSheetOpen).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
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
  it('does not fetch details when placeId is missing', () => {
    const props = createProps({placeId: undefined});
    render(<BusinessAddScreen {...props} />);

    expect(LinkedBusinessActions.fetchBusinessDetails).not.toHaveBeenCalled();
    expect(LinkedBusinessActions.fetchGooglePlacesImage).not.toHaveBeenCalled();
  });

  it('handles PMS image fetch failure gracefully', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    (
      LinkedBusinessActions.fetchGooglePlacesImage as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.reject(new Error('image failed')),
    });

    const props = createProps({isPMSRecord: true, placeId: 'place-err'});
    render(<BusinessAddScreen {...props} />);

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[BusinessAddScreen] Failed to fetch Places image:',
        expect.any(Error),
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('handles non-PMS details fetch failure gracefully', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    (
      LinkedBusinessActions.fetchBusinessDetails as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.reject(new Error('details failed')),
    });

    const props = createProps({isPMSRecord: false, placeId: 'place-err'});
    render(<BusinessAddScreen {...props} />);

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[BusinessAddScreen] Failed to fetch details:',
        expect.any(Error),
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('uses addLinkedBusiness for non-PMS Add flow when organisationId is missing', async () => {
    const mockUnwrap = jest.fn().mockResolvedValue({});

    (
      LinkedBusinessActions.addLinkedBusiness as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    const props = createProps({
      isPMSRecord: true,
      organisationId: undefined,
    });

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('btn-Add'));

    await waitFor(() => {
      expect(LinkedBusinessActions.addLinkedBusiness).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId: 'comp-123',
          businessId: 'biz-123',
          businessName: 'Test Vet Clinic',
        }),
      );
      expect(mockAddSheetOpen).toHaveBeenCalled();
    });
  });

  it('handles Notify Business failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    (
      LinkedBusinessActions.inviteBusiness as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.reject(new Error('invite failed')),
    });

    const props = createProps({isPMSRecord: false});
    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('btn-Notify Business'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to send invite. Please try again.',
      );
    });

    expect(mockNotifySheetOpen).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('navigates to returnTo tab when closing Add sheet', () => {
    const mockParentNavigate = jest.fn();

    const props = createProps({
      returnTo: {tab: 'HomeTab', screen: 'LinkedBusinesses'},
    });

    props.navigation.getParent = jest.fn(() => ({
      navigate: mockParentNavigate,
    }));

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('add-sheet-confirm'));

    expect(mockAddSheetClose).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'LinkedBusinesses',
    });
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('navigates to returnTo tab when pressing header back', () => {
    const mockParentNavigate = jest.fn();

    const props = createProps({
      returnTo: {tab: 'AppointmentsTab'},
    });

    props.navigation.getParent = jest.fn(() => ({
      navigate: mockParentNavigate,
    }));

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('header-back'));

    expect(mockParentNavigate).toHaveBeenCalledWith(
      'AppointmentsTab',
      undefined,
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('navigates to returnTo tab when closing Notify sheet', () => {
    const mockParentNavigate = jest.fn();

    const props = createProps({
      isPMSRecord: false,
      returnTo: {tab: 'CareTab', screen: 'CareHome'},
    });

    props.navigation.getParent = jest.fn(() => ({
      navigate: mockParentNavigate,
    }));

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('notify-sheet-confirm'));

    expect(mockNotifySheetClose).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('CareTab', {
      screen: 'CareHome',
    });
  });

  it('keeps the placeholder icon when the Places image has no photoUrl', async () => {
    (
      LinkedBusinessActions.fetchGooglePlacesImage as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: () => Promise.resolve({}), // no photoUrl -> SET_PHOTO not dispatched
    });

    const props = createProps({isPMSRecord: true, placeId: 'place-nophoto'});
    render(<BusinessAddScreen {...props} />);

    await waitFor(() => {
      expect(LinkedBusinessActions.fetchGooglePlacesImage).toHaveBeenCalledWith(
        'place-nophoto',
      );
    });

    // photoUri stays undefined -> placeholder Ionicon is rendered.
    expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
  });

  it('hides optional sections when their fields are absent', () => {
    const props = createProps({
      isPMSRecord: false,
      placeId: undefined,
      companionName: undefined,
      rating: undefined,
      distance: undefined,
      businessAddress: undefined,
      email: undefined,
      phone: undefined,
      photo: undefined,
    });

    render(<BusinessAddScreen {...props} />);

    // Business name still renders.
    expect(screen.getByText('Test Vet Clinic')).toBeTruthy();
    // No companion -> no "Link for" section.
    expect(screen.queryByText('Link for')).toBeNull();
    // No rating -> no star chip.
    expect(screen.queryByTestId('icon-star')).toBeNull();
    // No photo -> placeholder icon.
    expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
  });

  it('renders the placeholder icon when the photo is an empty string', () => {
    const props = createProps({
      isPMSRecord: false,
      placeId: undefined,
      photo: '', // typeof string but length 0 -> photoUri undefined
    });

    render(<BusinessAddScreen {...props} />);

    expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
  });

  it('adds a non-PMS business using fetched detail fallbacks', async () => {
    const mockUnwrap = jest.fn().mockResolvedValue({});
    (
      LinkedBusinessActions.addLinkedBusiness as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: mockUnwrap,
    });

    // details.phone / details.website are falsy while details.photo is truthy,
    // exercising the opposite side of the `details.x || param` fallbacks.
    const props = createProps({
      isPMSRecord: true,
      organisationId: undefined,
      placeId: undefined,
      phone: undefined,
      email: undefined,
      photo: 'param-photo',
    });

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('btn-Add'));

    await waitFor(() => {
      expect(LinkedBusinessActions.addLinkedBusiness).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId: 'comp-123',
          businessName: 'Test Vet Clinic',
          photo: 'param-photo',
        }),
      );
    });
  });

  it('shows the loading label on the Add button while adding', () => {
    (Redux.useSelector as unknown as jest.Mock).mockReturnValue(true);
    try {
      const props = createProps({isPMSRecord: true, placeId: undefined});
      render(<BusinessAddScreen {...props} />);

      expect(screen.getByText('Adding...')).toBeTruthy();
    } finally {
      (Redux.useSelector as unknown as jest.Mock).mockReturnValue(false);
    }
  });

  it('sends an invite with a fallback name when businessName is missing', async () => {
    const props = createProps({isPMSRecord: false, businessName: undefined});
    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('btn-Notify Business'));

    await waitFor(() => {
      expect(LinkedBusinessActions.inviteBusiness).toHaveBeenCalledWith(
        expect.objectContaining({businessName: 'Unknown Business'}),
      );
    });
  });

  it('navigates to returnTo tab (no screen) when pressing header back', () => {
    const mockParentNavigate = jest.fn();

    const props = createProps({
      returnTo: {tab: 'HomeTab', screen: 'LinkedBusinesses'},
    });

    props.navigation.getParent = jest.fn(() => ({
      navigate: mockParentNavigate,
    }));

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('header-back'));

    expect(mockParentNavigate).toHaveBeenCalledWith('HomeTab', {
      screen: 'LinkedBusinesses',
    });
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('navigates to returnTo tab without screen when closing Add sheet', () => {
    const mockParentNavigate = jest.fn();

    const props = createProps({
      isPMSRecord: true,
      returnTo: {tab: 'HomeTab'}, // no screen -> params undefined
    });

    props.navigation.getParent = jest.fn(() => ({
      navigate: mockParentNavigate,
    }));

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('add-sheet-confirm'));

    expect(mockAddSheetClose).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('HomeTab', undefined);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('navigates to returnTo tab without screen when closing Notify sheet', () => {
    const mockParentNavigate = jest.fn();

    const props = createProps({
      isPMSRecord: false,
      returnTo: {tab: 'CareTab'}, // no screen -> params undefined
    });

    props.navigation.getParent = jest.fn(() => ({
      navigate: mockParentNavigate,
    }));

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('notify-sheet-confirm'));

    expect(mockNotifySheetClose).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('CareTab', undefined);
  });

  it('does not navigate when the parent navigator is missing on back', () => {
    const props = createProps({returnTo: {tab: 'HomeTab'}});
    props.navigation.getParent = jest.fn(() => undefined);

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('header-back'));

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when the parent navigator is missing on Add close', () => {
    const props = createProps({isPMSRecord: true, returnTo: {tab: 'HomeTab'}});
    props.navigation.getParent = jest.fn(() => undefined);

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('add-sheet-confirm'));

    expect(mockAddSheetClose).toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when the parent navigator is missing on Notify close', () => {
    const props = createProps({isPMSRecord: false, returnTo: {tab: 'CareTab'}});
    props.navigation.getParent = jest.fn(() => undefined);

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('notify-sheet-confirm'));

    expect(mockNotifySheetClose).toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not go back when closing Add sheet with no navigation history', () => {
    const props = createProps({isPMSRecord: true}); // no returnTo
    props.navigation.canGoBack = jest.fn().mockReturnValue(false);

    render(<BusinessAddScreen {...props} />);

    fireEvent.press(screen.getByTestId('add-sheet-confirm'));

    expect(mockAddSheetClose).toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
