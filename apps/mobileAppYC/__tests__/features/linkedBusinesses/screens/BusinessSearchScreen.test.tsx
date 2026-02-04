import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {BusinessSearchScreen} from '../../../../src/features/linkedBusinesses/screens/BusinessSearchScreen';
import {useDispatch, useSelector} from 'react-redux';
import LocationService from '../../../../src/shared/services/LocationService';
import {Alert} from 'react-native';
import * as LinkedBusinessActions from '../../../../src/features/linkedBusinesses/index';

// --- Mocks ---

// Mock Redux
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  const ReactActual = jest.requireActual('react'); // Get React inside the factory
  return {
    ...actualNav,
    // Use the locally required React to avoid ReferenceError
    useFocusEffect: (effect: any) => ReactActual.useEffect(effect, [effect]),
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(),
    }),
  };
});

// Mock Location Service
jest.mock('../../../../src/shared/services/LocationService', () => ({
  getCurrentPosition: jest.fn(),
}));

// Mock Navigation Props
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn();

// Mock Hooks
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {background: 'white', text: 'black', textSecondary: 'gray'},
      spacing: {
        '1': 4,
        '2': 8,
        '3': 12,
        '4': 16,
        '6': 24,
        '12': 48,
        '24': 96,
        '80': 320,
      },
      typography: {sectionHeading: {}, body: {}},
    },
  }),
}));

// Mock Actions and Components
jest.mock('../../../../src/features/linkedBusinesses/index', () => {
  const ReactActual = jest.requireActual('react'); // Get React inside the factory
  const {View: MockView} = require('react-native');
  return {
    searchBusinessesByLocation: jest.fn(() => ({
      type: 'search/businesses',
      payload: [],
    })),
    fetchLinkedBusinesses: jest.fn(() => ({
      type: 'business/fetch',
      payload: [],
    })),
    checkOrganisation: jest.fn(() => ({type: 'business/check', payload: {}})),
    acceptBusinessInvite: jest.fn(() => ({type: 'business/accept'})),
    declineBusinessInvite: jest.fn(() => ({type: 'business/decline'})),
    fetchPlaceCoordinates: jest.fn(() => ({type: 'place/coords', payload: {}})),
    selectLinkedBusinesses: jest.fn(),
    deleteLinkedBusiness: jest.fn(() => ({type: 'business/delete'})),

    DeleteBusinessBottomSheet: ReactActual.forwardRef(
      (props: any, ref: any) => {
        ReactActual.useImperativeHandle(ref, () => ({
          open: () => {},
        }));
        return (
          <MockView testID="delete-sheet">
            <MockView testID="confirm-delete-btn" onTouchEnd={props.onDelete} />
            <MockView testID="cancel-delete-btn" onTouchEnd={props.onCancel} />
          </MockView>
        );
      },
    ),
  };
});

jest.spyOn(Alert, 'alert');

// Mock UI Components
jest.mock('../../../../src/shared/components/common/Header/Header', () => {
  const {View: MockView} = require('react-native');
  return {
    Header: ({onBack}: any) => (
      <MockView testID="mock-header" onTouchEnd={onBack} />
    ),
  };
});

jest.mock(
  '../../../../src/shared/components/common/SearchBar/SearchBar',
  () => {
    const {View: MockView, TextInput: MockTextInput} = require('react-native');
    return {
      SearchBar: ({onChangeText, value}: any) => (
        <MockView testID="search-bar">
          <MockTextInput
            testID="search-input"
            onChangeText={onChangeText}
            value={value}
          />
        </MockView>
      ),
    };
  },
);

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View: MockView} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({children, header}: any) => (
        <MockView testID="liquid-layout">
          {header}
          {children({paddingBottom: 0})}
        </MockView>
      ),
    };
  },
);

jest.mock(
  '../../../../src/shared/components/common/SearchDropdownOverlay/SearchDropdownOverlay',
  () => {
    const {View: MockView} = require('react-native');
    return {
      SearchDropdownOverlay: ({visible, onPress, items}: any) =>
        visible ? (
          <MockView testID="dropdown-overlay">
            {items.map((item: any) => (
              <MockView
                key={item.id}
                testID={`result-${item.id}`}
                onTouchEnd={() => onPress(item)}
              />
            ))}
          </MockView>
        ) : null,
    };
  },
);

jest.mock(
  '../../../../src/features/linkedBusinesses/components/InviteCard',
  () => {
    const {View: MockView} = require('react-native');
    return {
      InviteCard: ({onAccept, onDecline}: any) => (
        <MockView testID="invite-card">
          <MockView testID="accept-btn" onTouchEnd={onAccept} />
          <MockView testID="decline-btn" onTouchEnd={onDecline} />
        </MockView>
      ),
    };
  },
);

jest.mock(
  '../../../../src/features/linkedBusinesses/components/LinkedBusinessCard',
  () => {
    const {View: MockView} = require('react-native');
    return {
      LinkedBusinessCard: ({onDeletePress, business}: any) => (
        <MockView testID={`linked-card-${business.id}`}>
          <MockView
            testID="delete-btn"
            onTouchEnd={() => onDeletePress(business)}
          />
        </MockView>
      ),
    };
  },
);

jest.mock(
  '../../../../src/features/linkedBusinesses/components/CompanionProfileImage',
  () => {
    const {View: MockView} = require('react-native');
    return {
      CompanionProfileImage: () => <MockView testID="profile-image" />,
    };
  },
);

describe('BusinessSearchScreen', () => {
  const mockDispatch = jest.fn();

  const routeParams = {
    companionId: 'comp-123',
    companionName: 'Buddy',
    companionBreed: 'Dog',
    companionImage: 'url',
    category: 'veterinarian',
  };

  const mockNavigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  } as any;

  const mockRoute = {params: routeParams} as any;

  const linkedBusinessData = [
    {
      id: 'lb-1',
      companionId: 'comp-123',
      category: 'veterinarian',
      inviteStatus: 'accepted',
      state: 'active',
      businessName: 'Vet One',
    },
    {
      id: 'lb-2',
      companionId: 'comp-123',
      category: 'veterinarian',
      inviteStatus: 'pending',
      state: 'pending',
      businessName: 'Vet Pending',
      linkId: 'link-2',
    },
    {
      id: 'lb-3',
      companionId: 'other-comp',
      category: 'veterinarian',
      businessName: 'Other Vet',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);

    mockDispatch.mockImplementation((action: any) => {
      if (action?.type === 'throw') {
        return {unwrap: () => Promise.reject(new Error('Mock Error'))};
      }
      return {unwrap: () => Promise.resolve(action?.payload || [])};
    });

    (useSelector as unknown as jest.Mock).mockReturnValue(linkedBusinessData);
    (LocationService.getCurrentPosition as jest.Mock).mockResolvedValue({
      latitude: 10,
      longitude: 20,
    });
    (
      LinkedBusinessActions.selectLinkedBusinesses as unknown as jest.Mock
    ).mockReturnValue(linkedBusinessData);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderScreen = () =>
    render(
      <BusinessSearchScreen navigation={mockNavigation} route={mockRoute} />,
    );

  describe('Initialization & Rendering', () => {
    it('fetches location and linked businesses on mount', async () => {
      renderScreen();
      await waitFor(() => {
        expect(LocationService.getCurrentPosition).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({type: 'business/fetch'}),
        );
      });
    });

    it('handles location fetch failure gracefully', async () => {
      (LocationService.getCurrentPosition as jest.Mock).mockRejectedValue(
        new Error('GPS off'),
      );
      renderScreen();
      await waitFor(() =>
        expect(LocationService.getCurrentPosition).toHaveBeenCalled(),
      );
    });

    it('renders linked businesses and invites filtered by companionId', () => {
      const {getByTestId, queryByTestId} = renderScreen();
      expect(getByTestId('invite-card')).toBeTruthy();
      expect(getByTestId('linked-card-lb-1')).toBeTruthy();
      expect(queryByTestId('linked-card-lb-3')).toBeNull();
    });

    it('renders empty state if no linked businesses', () => {
      (useSelector as unknown as jest.Mock).mockReturnValue([]);
      const {getByText} = renderScreen();
      expect(getByText(/No linked veterinarians yet/i)).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    it('updates search query but does not search if length < 3', () => {
      const {getByTestId} = renderScreen();
      const input = getByTestId('search-input');

      fireEvent.changeText(input, 'ab');

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(
        LinkedBusinessActions.searchBusinessesByLocation,
      ).not.toHaveBeenCalled();
    });

    it('debounces search and makes API call', async () => {
      const {getByTestId} = renderScreen();
      const input = getByTestId('search-input');

      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'search/businesses',
        payload: [{id: 'res-1', name: 'Result Vet'}],
      });

      fireEvent.changeText(input, 'abc');

      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(
        LinkedBusinessActions.searchBusinessesByLocation,
      ).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(
        LinkedBusinessActions.searchBusinessesByLocation,
      ).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({type: 'search/businesses'}),
      );
    });

    it('handles search errors gracefully', async () => {
      const {getByTestId} = renderScreen();
      const input = getByTestId('search-input');

      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'throw',
      });

      fireEvent.changeText(input, 'error_case');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    });

    it('skips API call if query has not changed', async () => {
      const {getByTestId} = renderScreen();
      const input = getByTestId('search-input');

      fireEvent.changeText(input, 'same');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockClear();

      fireEvent.changeText(input, 'same');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(
        LinkedBusinessActions.searchBusinessesByLocation,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Business Selection Logic', () => {
    const mockSearchResult = {
      id: 'place-new',
      name: 'New Vet',
      address: '123 St',
      lat: 10,
      lng: 10,
      phone: '123',
      email: 'a@a.com',
      rating: 5,
      distance: 1,
    };

    it('prevents selecting already linked business', async () => {
      const {getByTestId} = renderScreen();

      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'search',
        payload: [
          {
            id: 'res-existing',
            name: 'Vet One',
            address: 'addr',
            lat: 1,
            lng: 1,
          },
        ],
      });

      const input = getByTestId('search-input');
      fireEvent.changeText(input, 'Vet One');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const item = getByTestId('result-res-existing');
      fireEvent(item, 'onTouchEnd');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Already Linked',
        expect.stringContaining('already linked'),
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('fetches coordinates if missing, then checks organisation', async () => {
      const {getByTestId} = renderScreen();
      const businessNoCoords = {
        ...mockSearchResult,
        lat: undefined,
        lng: undefined,
      };

      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'search',
        payload: [businessNoCoords],
      });
      (
        LinkedBusinessActions.fetchPlaceCoordinates as unknown as jest.Mock
      ).mockReturnValue({
        type: 'coords',
        payload: {latitude: 55, longitude: 66},
      });
      (
        LinkedBusinessActions.checkOrganisation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'check',
        payload: {isPmsOrganisation: false},
      });

      const input = getByTestId('search-input');
      fireEvent.changeText(input, 'New Vet');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const item = getByTestId('result-place-new');
      await act(async () => {
        fireEvent(item, 'onTouchEnd');
      });

      expect(LinkedBusinessActions.fetchPlaceCoordinates).toHaveBeenCalledWith(
        'place-new',
      );
      expect(LinkedBusinessActions.checkOrganisation).toHaveBeenCalledWith(
        expect.objectContaining({lat: 55, lng: 66}),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({
          isPMSRecord: false,
          businessId: 'place-new',
        }),
      );
    });

    it('navigates to BusinessAdd immediately if fetching coordinates fails', async () => {
      const {getByTestId} = renderScreen();
      const businessNoCoords = {
        ...mockSearchResult,
        lat: undefined,
        lng: undefined,
      };

      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'search', payload: [businessNoCoords]});
      (
        LinkedBusinessActions.fetchPlaceCoordinates as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});

      const input = getByTestId('search-input');
      fireEvent.changeText(input, 'New Vet');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const item = getByTestId('result-place-new');
      await act(async () => {
        fireEvent(item, 'onTouchEnd');
      });

      expect(LinkedBusinessActions.checkOrganisation).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({
          isPMSRecord: false,
        }),
      );
    });

    it('handles PMS organisation match', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'search', payload: [mockSearchResult]});
      (
        LinkedBusinessActions.checkOrganisation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'check',
        payload: {isPmsOrganisation: true, organisationId: 'org-pms'},
      });

      const input = getByTestId('search-input');
      fireEvent.changeText(input, 'New Vet');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const item = getByTestId('result-place-new');
      await act(async () => {
        fireEvent(item, 'onTouchEnd');
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({
          isPMSRecord: true,
          businessId: 'org-pms',
          placeId: 'place-new',
        }),
      );
    });

    it('falls back to Non-PMS if checkOrganisation fails', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'search', payload: [mockSearchResult]});
      (
        LinkedBusinessActions.checkOrganisation as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});

      const input = getByTestId('search-input');
      fireEvent.changeText(input, 'New Vet');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const item = getByTestId('result-place-new');
      await act(async () => {
        fireEvent(item, 'onTouchEnd');
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({
          isPMSRecord: false,
        }),
      );
    });
  });

  describe('Invite & Delete Actions', () => {
    it('accepts invite and refreshes list', async () => {
      const {getByTestId} = renderScreen();
      const acceptBtn = getByTestId('accept-btn');
      await act(async () => {
        fireEvent(acceptBtn, 'onTouchEnd');
      });

      expect(LinkedBusinessActions.acceptBusinessInvite).toHaveBeenCalledWith(
        'link-2',
      );
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Invite accepted!');
    });

    it('declines invite and refreshes list', async () => {
      const {getByTestId} = renderScreen();
      const declineBtn = getByTestId('decline-btn');
      await act(async () => {
        fireEvent(declineBtn, 'onTouchEnd');
      });

      expect(LinkedBusinessActions.declineBusinessInvite).toHaveBeenCalledWith(
        'link-2',
      );
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Invite declined!');
    });

    it('handles errors during accept invite', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.acceptBusinessInvite as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});

      const acceptBtn = getByTestId('accept-btn');
      await act(async () => {
        fireEvent(acceptBtn, 'onTouchEnd');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to accept'),
      );
    });

    it('deletes linked business via confirmation sheet', async () => {
      const {getByTestId} = renderScreen();

      const deleteBtn = getByTestId('delete-btn');
      await act(async () => {
        fireEvent(deleteBtn, 'onTouchEnd');
      });

      const confirmBtn = getByTestId('confirm-delete-btn');
      await act(async () => {
        fireEvent(confirmBtn, 'onTouchEnd');
      });

      expect(LinkedBusinessActions.deleteLinkedBusiness).toHaveBeenCalledWith(
        'lb-1',
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        expect.stringContaining('removed'),
      );
    });

    it('handles delete error', async () => {
      (
        LinkedBusinessActions.deleteLinkedBusiness as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});
      const {getByTestId} = renderScreen();

      const deleteBtn = getByTestId('delete-btn');
      await act(async () => {
        fireEvent(deleteBtn, 'onTouchEnd');
      });

      const confirmBtn = getByTestId('confirm-delete-btn');
      await act(async () => {
        fireEvent(confirmBtn, 'onTouchEnd');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to delete'),
      );
    });
  });

  describe('Navigation & UI', () => {
    it('goes back when header back button pressed', () => {
      mockCanGoBack.mockReturnValue(true);
      const {getByTestId} = renderScreen();
      const header = getByTestId('mock-header');
      fireEvent(header, 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
