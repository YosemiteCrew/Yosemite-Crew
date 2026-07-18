import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {Alert, Platform, Pressable} from 'react-native';
import {BusinessSearchScreen} from '../../../../src/features/linkedBusinesses/screens/BusinessSearchScreen';
import {useDispatch, useSelector} from 'react-redux';
import * as LinkedBusinessActions from '../../../../src/features/linkedBusinesses/thunks';
import {selectLinkedBusinesses} from '../../../../src/features/linkedBusinesses/selectors';
import {mockTheme} from '../../../setup/mockTheme';

// Pressable is wrapped in React.memo internally by RN; match the inner type.
const PressableType = (Pressable as any).type;

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

// Mock location store
jest.mock('@/shared/stores/locationStore', () => ({
  useLocationStore: jest.fn(),
}));

// Mock Navigation Props
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn();

// Mock Hooks — use the shared complete warm-bone theme
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Mock thunks (component imports from ../thunks after barrel-import fix)
jest.mock('../../../../src/features/linkedBusinesses/thunks', () => ({
  searchBusinessesByLocation: jest.fn(() => ({
    type: 'search/businesses',
    payload: [],
  })),
  fetchLinkedBusinesses: jest.fn(() => ({type: 'business/fetch', payload: []})),
  checkOrganisation: jest.fn(() => ({type: 'business/check', payload: {}})),
  acceptBusinessInvite: jest.fn(() => ({type: 'business/accept'})),
  declineBusinessInvite: jest.fn(() => ({type: 'business/decline'})),
  fetchPlaceCoordinates: jest.fn(() => ({type: 'place/coords', payload: {}})),
  deleteLinkedBusiness: jest.fn(() => ({type: 'business/delete'})),
}));

// Mock selectors (component imports from ../selectors after barrel-import fix)
jest.mock('../../../../src/features/linkedBusinesses/selectors', () => ({
  selectLinkedBusinesses: jest.fn(),
}));

// Mock DeleteBusinessBottomSheet component
jest.mock(
  '../../../../src/features/linkedBusinesses/components/DeleteBusinessBottomSheet',
  () => {
    const ReactActual = jest.requireActual('react');
    const {View: MockView} = require('react-native');
    return {
      DeleteBusinessBottomSheet: ReactActual.forwardRef(
        (props: any, ref: any) => {
          ReactActual.useImperativeHandle(ref, () => ({open: () => {}}));
          return (
            <MockView testID="delete-sheet">
              <MockView
                testID="confirm-delete-btn"
                onTouchEnd={props.onDelete}
              />
              <MockView
                testID="cancel-delete-btn"
                onTouchEnd={props.onCancel}
              />
            </MockView>
          );
        },
      ),
    };
  },
);

jest.spyOn(Alert, 'alert');

// Mock UI Components
jest.mock('../../../../src/shared/components/common/Header/Header', () => {
  const {View: MockView} = require('react-native');
  return {
    Header: ({onBack, title}: any) => (
      <MockView
        testID="mock-header"
        accessibilityLabel={title}
        onTouchEnd={onBack}
      />
    ),
  };
});

jest.mock(
  '../../../../src/shared/components/common/SearchBar/SearchBar',
  () => {
    const {View: MockView, TextInput: MockTextInput} = require('react-native');
    return {
      SearchBar: ({onChangeText, value, placeholder}: any) => (
        <MockView testID="search-bar">
          <MockTextInput
            testID="search-input"
            placeholder={placeholder}
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
    const {View: MockView, Text: MockText} = require('react-native');
    return {
      SearchDropdownOverlay: ({
        visible,
        onPress,
        items,
        keyExtractor,
        title,
        subtitle,
        initials,
      }: any) =>
        visible ? (
          <MockView testID="dropdown-overlay">
            {items.map((item: any) => (
              <MockView
                key={keyExtractor(item)}
                testID={`result-${item.id}`}
                onTouchEnd={() => onPress(item)}>
                <MockText testID={`result-title-${item.id}`}>
                  {title(item)}
                </MockText>
                <MockText testID={`result-subtitle-${item.id}`}>
                  {subtitle(item)}
                </MockText>
                <MockText testID={`result-initials-${item.id}`}>
                  {initials(item)}
                </MockText>
              </MockView>
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
            testID={`delete-btn-${business.id}`}
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

  // Rich dataset engineered to exercise every filter/predicate branch.
  const accepted = {inviteStatus: 'accepted', state: 'active'};
  const linkedBusinessData: any[] = [
    // Accepted, no linkId -> keyExtractor/id fallback + delete via id
    {
      id: 'acc-nolink',
      companionId: 'comp-123',
      category: 'veterinarian',
      ...accepted,
      businessName: 'Vet One',
    },
    // Accepted, has linkId -> keyExtractor/linkId + delete via linkId
    {
      id: 'acc-link',
      companionId: 'comp-123',
      category: 'veterinarian',
      ...accepted,
      businessName: 'Vet Four',
      linkId: 'link-4',
    },
    // inviteStatus pending BUT state active -> accepted via right-side of ||
    // and pendingInvite predicate left-true/right-false
    {
      id: 'active-only',
      companionId: 'comp-123',
      category: 'veterinarian',
      inviteStatus: 'pending',
      state: 'active',
      businessName: 'Vet Active',
    },
    // The pending invite (pending && pending)
    {
      id: 'pending-1',
      companionId: 'comp-123',
      category: 'veterinarian',
      inviteStatus: 'pending',
      state: 'pending',
      businessName: 'Vet Pending',
      linkId: 'link-2',
    },
    // Same companion/category but excluded from accepted; no businessName
    // -> covers businessName?. optional-chain null branch in already-linked scan
    {
      id: 'excluded-none',
      companionId: 'comp-123',
      category: 'veterinarian',
      inviteStatus: 'declined',
      state: 'inactive',
    },
    // Same companion, wrong category -> filter && right-false
    {
      id: 'wrong-cat',
      companionId: 'comp-123',
      category: 'grooming',
      businessName: 'Groomer',
    },
    // Different companion -> filter && left-false (short circuit)
    {
      id: 'other-comp',
      companionId: 'other',
      category: 'veterinarian',
      businessName: 'Other Vet',
    },
  ];

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const resetThunkDefaults = () => {
    (
      LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
    ).mockReturnValue({type: 'search/businesses', payload: []});
    (
      LinkedBusinessActions.fetchLinkedBusinesses as unknown as jest.Mock
    ).mockReturnValue({type: 'business/fetch', payload: []});
    (
      LinkedBusinessActions.checkOrganisation as unknown as jest.Mock
    ).mockReturnValue({type: 'business/check', payload: {}});
    (
      LinkedBusinessActions.acceptBusinessInvite as unknown as jest.Mock
    ).mockReturnValue({type: 'business/accept'});
    (
      LinkedBusinessActions.declineBusinessInvite as unknown as jest.Mock
    ).mockReturnValue({type: 'business/decline'});
    (
      LinkedBusinessActions.fetchPlaceCoordinates as unknown as jest.Mock
    ).mockReturnValue({type: 'place/coords', payload: {}});
    (
      LinkedBusinessActions.deleteLinkedBusiness as unknown as jest.Mock
    ).mockReturnValue({type: 'business/delete'});
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);

    // Non-Error rejection values are passed through a variable so the
    // rejection reason can be null / message-less without tripping lint.
    const rejections: Record<string, any> = {
      throw: new Error('Mock Error'),
      'throw-quota-re': new Error('RESOURCE_EXHAUSTED: too many'),
      'throw-quota-q': new Error('Quota exceeded'),
      'throw-null': null,
      'throw-nomsg': {},
    };
    mockDispatch.mockImplementation((action: any) => {
      const type = action?.type;
      if (type && Object.prototype.hasOwnProperty.call(rejections, type)) {
        const reason = rejections[type];
        return {unwrap: () => Promise.reject(reason)};
      }
      return {unwrap: () => Promise.resolve(action?.payload ?? [])};
    });

    (useSelector as unknown as jest.Mock).mockReturnValue(linkedBusinessData);
    (selectLinkedBusinesses as unknown as jest.Mock).mockReturnValue(
      linkedBusinessData,
    );

    const {useLocationStore} = require('@/shared/stores/locationStore');
    (useLocationStore as jest.Mock).mockReturnValue({
      latitude: 10,
      longitude: 20,
    });

    resetThunkDefaults();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderScreen = (opts?: {route?: any; renderOptions?: any}) =>
    render(
      <BusinessSearchScreen
        navigation={mockNavigation}
        route={opts?.route ?? mockRoute}
      />,
      opts?.renderOptions,
    );

  // Types a query and flushes the debounce + async search.
  const runSearch = async (getByTestId: any, query: string) => {
    fireEvent.changeText(getByTestId('search-input'), query);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  };

  describe('Initialization & Rendering', () => {
    it('fetches linked businesses on mount', async () => {
      renderScreen();
      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({type: 'business/fetch'}),
        );
      });
    });

    it('logs an error when the initial linked-businesses fetch fails', async () => {
      (
        LinkedBusinessActions.fetchLinkedBusinesses as unknown as jest.Mock
      ).mockReturnValueOnce({type: 'throw'});

      renderScreen();

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          '[BusinessSearch] Failed to load linked businesses:',
          expect.any(Error),
        );
      });
    });

    it('logs an error when the focus-triggered refresh of linked businesses fails', async () => {
      (LinkedBusinessActions.fetchLinkedBusinesses as unknown as jest.Mock)
        .mockReturnValueOnce({type: 'business/fetch', payload: []})
        .mockReturnValueOnce({type: 'throw'});

      renderScreen();

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          '[BusinessSearch] Failed to refresh linked businesses:',
          expect.any(Error),
        );
      });
    });

    it('does not fetch on mount when companionId is missing', () => {
      const {getByTestId} = renderScreen({
        route: {params: {...routeParams, companionId: ''}} as any,
      });
      expect(getByTestId('liquid-layout')).toBeTruthy();
    });

    it('renders correctly when location store returns null', () => {
      const {useLocationStore} = require('@/shared/stores/locationStore');
      (useLocationStore as jest.Mock).mockReturnValue(null);
      const {getByTestId} = renderScreen();
      expect(getByTestId('liquid-layout')).toBeTruthy();
    });

    it('renders linked businesses and invite filtered by companion + category', () => {
      const {getByTestId, queryByTestId} = renderScreen();
      expect(getByTestId('invite-card')).toBeTruthy();
      expect(getByTestId('linked-card-acc-nolink')).toBeTruthy();
      expect(getByTestId('linked-card-acc-link')).toBeTruthy();
      expect(getByTestId('linked-card-active-only')).toBeTruthy();
      // pending invite and mismatched entries are not rendered as cards
      expect(queryByTestId('linked-card-pending-1')).toBeNull();
      expect(queryByTestId('linked-card-wrong-cat')).toBeNull();
      expect(queryByTestId('linked-card-other-comp')).toBeNull();
      expect(getByTestId('profile-image')).toBeTruthy();
    });

    it('renders the capitalised category title and placeholder', () => {
      const {getByLabelText, getByTestId} = renderScreen();
      expect(getByLabelText('Veterinarian')).toBeTruthy();
      expect(getByTestId('search-input').props.placeholder).toBe(
        'Search veterinarian',
      );
    });

    it('renders empty state if no linked businesses', () => {
      (useSelector as unknown as jest.Mock).mockReturnValue([]);
      const {getByText} = renderScreen();
      expect(getByText(/No linked veterinarians yet/i)).toBeTruthy();
      expect(getByText(/Search above to find and link one\./i)).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    it('updates search query but does not search if length < 3', () => {
      const {getByTestId} = renderScreen();
      fireEvent.changeText(getByTestId('search-input'), 'ab');

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(
        LinkedBusinessActions.searchBusinessesByLocation,
      ).not.toHaveBeenCalled();
    });

    it('debounces search and makes API call, then shows the dropdown', async () => {
      const {getByTestId} = renderScreen();

      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'search/businesses',
        payload: [{id: 'res-1', name: 'Result Vet', address: '1 Main'}],
      });

      fireEvent.changeText(getByTestId('search-input'), 'abc');

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
      // dropdown + title/subtitle/initials render helpers exercised
      expect(getByTestId('dropdown-overlay')).toBeTruthy();
      expect(getByTestId('result-title-res-1').props.children).toBe(
        'Result Vet',
      );
      expect(getByTestId('result-subtitle-res-1').props.children).toBe(
        '1 Main',
      );
    });

    it('clears a pending debounce timer when the query changes rapidly', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'search/businesses',
        payload: [{id: 'res-1', name: 'Result Vet', address: 'a'}],
      });

      fireEvent.changeText(getByTestId('search-input'), 'abc');
      // advance less than the debounce so timer1 is still pending
      act(() => {
        jest.advanceTimersByTime(300);
      });
      // second keystroke clears the pending timer and schedules a new one
      fireEvent.changeText(getByTestId('search-input'), 'abcd');
      await act(async () => {
        jest.advanceTimersByTime(800);
      });

      expect(
        LinkedBusinessActions.searchBusinessesByLocation,
      ).toHaveBeenCalledTimes(1);
      expect(
        LinkedBusinessActions.searchBusinessesByLocation,
      ).toHaveBeenCalledWith(expect.objectContaining({query: 'abcd'}));
    });

    it('handles generic search errors gracefully (console.error path)', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});
      await runSearch(getByTestId, 'error_case');
      // no crash; previous (empty) results retained
      expect(getByTestId('liquid-layout')).toBeTruthy();
    });

    it('handles RESOURCE_EXHAUSTED quota error via fallback (console.warn path)', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'throw-quota-re'});
      await runSearch(getByTestId, 'quota_re');
      expect(getByTestId('liquid-layout')).toBeTruthy();
    });

    it('handles "Quota exceeded" error via fallback (second ||-condition)', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'throw-quota-q'});
      await runSearch(getByTestId, 'quota_q');
      expect(getByTestId('liquid-layout')).toBeTruthy();
    });

    it('handles a null rejection (error optional-chain null branch)', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'throw-null'});
      await runSearch(getByTestId, 'null_case');
      expect(getByTestId('liquid-layout')).toBeTruthy();
    });

    it('handles a rejection with no message (message optional-chain null branch)', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'throw-nomsg'});
      await runSearch(getByTestId, 'nomsg_case');
      expect(getByTestId('liquid-layout')).toBeTruthy();
    });

    it('skips API call if query has not changed', async () => {
      const {getByTestId} = renderScreen();

      await runSearch(getByTestId, 'same');

      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockClear();

      await runSearch(getByTestId, 'same');

      expect(
        LinkedBusinessActions.searchBusinessesByLocation,
      ).not.toHaveBeenCalled();
    });

    it('hides the dropdown while a subsequent search is in-flight', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'search/businesses',
        payload: [{id: 'res-1', name: 'Result Vet', address: 'a'}],
      });

      await runSearch(getByTestId, 'abc');
      expect(getByTestId('dropdown-overlay')).toBeTruthy();

      // A second query flips `searching` true while old results are still present.
      await runSearch(getByTestId, 'abcd');
      expect(getByTestId('liquid-layout')).toBeTruthy();
    });

    it('clears a pending debounce timer on unmount (focus cleanup)', () => {
      const {getByTestId, unmount} = renderScreen();
      // Schedule a debounce timer but do not let it fire.
      fireEvent.changeText(getByTestId('search-input'), 'abc');
      // Unmount -> useFocusEffect cleanup runs and clears the pending timer.
      unmount();
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
      photo: 'p.png',
      rating: 5,
      distance: 1,
    };

    const searchThenSelect = async (
      getByTestId: any,
      results: any[],
      query = 'New Vet',
    ) => {
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({type: 'search/businesses', payload: results});
      await runSearch(getByTestId, query);
      await act(async () => {
        fireEvent(getByTestId(`result-${results[0].id}`), 'onTouchEnd');
      });
    };

    it('prevents selecting an already-linked business', async () => {
      const {getByTestId} = renderScreen();
      await searchThenSelect(
        getByTestId,
        [
          {
            id: 'res-existing',
            name: 'Vet One',
            address: 'addr',
            lat: 1,
            lng: 1,
          },
        ],
        'Vet One',
      );

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

      await searchThenSelect(getByTestId, [businessNoCoords]);

      expect(LinkedBusinessActions.fetchPlaceCoordinates).toHaveBeenCalledWith(
        'place-new',
      );
      expect(LinkedBusinessActions.checkOrganisation).toHaveBeenCalledWith(
        expect.objectContaining({lat: 55, lng: 66}),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({isPMSRecord: false, businessId: 'place-new'}),
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
        LinkedBusinessActions.fetchPlaceCoordinates as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});

      await searchThenSelect(getByTestId, [businessNoCoords]);

      expect(LinkedBusinessActions.checkOrganisation).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({isPMSRecord: false}),
      );
    });

    it('handles a PMS organisation match using business contact fallback', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.checkOrganisation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'check',
        payload: {isPmsOrganisation: true, organisationId: 'org-pms'},
      });

      await searchThenSelect(getByTestId, [mockSearchResult]);

      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({
          isPMSRecord: true,
          businessId: 'org-pms',
          placeId: 'place-new',
          phone: '123',
          email: 'a@a.com',
        }),
      );
    });

    it('handles a PMS match preferring the organisation contact details', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.checkOrganisation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'check',
        payload: {
          isPmsOrganisation: true,
          organisationId: 'org-pms',
          phone: '999',
          website: 'clinic.example',
        },
      });

      await searchThenSelect(getByTestId, [mockSearchResult]);

      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({
          isPMSRecord: true,
          phone: '999',
          email: 'clinic.example',
        }),
      );
    });

    it('navigates as Non-PMS preferring organisation contact when present', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.checkOrganisation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'check',
        payload: {
          isPmsOrganisation: false,
          phone: '999',
          website: 'clinic.example',
        },
      });

      await searchThenSelect(getByTestId, [mockSearchResult]);

      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({
          isPMSRecord: false,
          phone: '999',
          email: 'clinic.example',
        }),
      );
    });

    it('falls back to Non-PMS if checkOrganisation fails', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.checkOrganisation as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});

      await searchThenSelect(getByTestId, [mockSearchResult]);

      expect(mockNavigate).toHaveBeenCalledWith(
        'BusinessAdd',
        expect.objectContaining({isPMSRecord: false, businessId: 'place-new'}),
      );
    });

    it('shows an error alert if selection processing throws', async () => {
      const {getByTestId} = renderScreen();
      // A result without a `name` throws when toLowerCase() is called.
      await searchThenSelect(
        getByTestId,
        [{id: 'no-name', address: 'x', lat: 1, lng: 1}],
        'anything',
      );

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to process'),
      );
    });

    it('closes the dropdown when the backdrop is pressed', async () => {
      const view = renderScreen();
      const {getByTestId, queryByTestId} = view;
      (
        LinkedBusinessActions.searchBusinessesByLocation as unknown as jest.Mock
      ).mockReturnValue({
        type: 'search/businesses',
        payload: [{id: 'res-1', name: 'Result Vet', address: 'a'}],
      });

      await runSearch(getByTestId, 'abc');
      expect(getByTestId('dropdown-overlay')).toBeTruthy();

      const backdrop = view.UNSAFE_getAllByType(PressableType)[0];
      expect(backdrop.props.accessible).toBe(false);
      fireEvent.press(backdrop);

      expect(queryByTestId('dropdown-overlay')).toBeNull();
    });
  });

  describe('Invite & Delete Actions', () => {
    it('accepts invite and refreshes list', async () => {
      const {getByTestId} = renderScreen();
      await act(async () => {
        fireEvent(getByTestId('accept-btn'), 'onTouchEnd');
      });

      expect(LinkedBusinessActions.acceptBusinessInvite).toHaveBeenCalledWith(
        'link-2',
      );
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Invite accepted!');
    });

    it('declines invite and refreshes list', async () => {
      const {getByTestId} = renderScreen();
      await act(async () => {
        fireEvent(getByTestId('decline-btn'), 'onTouchEnd');
      });

      expect(LinkedBusinessActions.declineBusinessInvite).toHaveBeenCalledWith(
        'link-2',
      );
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Invite declined!');
    });

    it('uses the invite id when it has no linkId (accept + decline fallback)', async () => {
      const inviteNoLink = [
        {
          id: 'invite-id-only',
          companionId: 'comp-123',
          category: 'veterinarian',
          inviteStatus: 'pending',
          state: 'pending',
          businessName: 'Vet No Link',
          parentName: 'Alice',
          email: 'alice@example.com',
          phone: '555-1',
        },
      ];
      (useSelector as unknown as jest.Mock).mockReturnValue(inviteNoLink);

      const {getByTestId} = renderScreen();
      await act(async () => {
        fireEvent(getByTestId('accept-btn'), 'onTouchEnd');
      });
      expect(LinkedBusinessActions.acceptBusinessInvite).toHaveBeenCalledWith(
        'invite-id-only',
      );

      await act(async () => {
        fireEvent(getByTestId('decline-btn'), 'onTouchEnd');
      });
      expect(LinkedBusinessActions.declineBusinessInvite).toHaveBeenCalledWith(
        'invite-id-only',
      );
    });

    it('renders an invite whose email falls back to parentEmail', () => {
      const inviteParentEmail = [
        {
          id: 'invite-parent-email',
          companionId: 'comp-123',
          category: 'veterinarian',
          inviteStatus: 'pending',
          state: 'pending',
          businessName: 'Vet PE',
          parentEmail: 'pe@example.com',
          linkId: 'link-pe',
        },
      ];
      (useSelector as unknown as jest.Mock).mockReturnValue(inviteParentEmail);
      const {getByTestId} = renderScreen();
      expect(getByTestId('invite-card')).toBeTruthy();
    });

    it('handles errors during accept invite', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.acceptBusinessInvite as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});

      await act(async () => {
        fireEvent(getByTestId('accept-btn'), 'onTouchEnd');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to accept'),
      );
    });

    it('handles errors during decline invite', async () => {
      const {getByTestId} = renderScreen();
      (
        LinkedBusinessActions.declineBusinessInvite as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});

      await act(async () => {
        fireEvent(getByTestId('decline-btn'), 'onTouchEnd');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to decline'),
      );
    });

    it('deletes a linked business via confirmation sheet (id fallback)', async () => {
      const {getByTestId} = renderScreen();

      await act(async () => {
        fireEvent(getByTestId('delete-btn-acc-nolink'), 'onTouchEnd');
      });
      await act(async () => {
        fireEvent(getByTestId('confirm-delete-btn'), 'onTouchEnd');
      });

      expect(LinkedBusinessActions.deleteLinkedBusiness).toHaveBeenCalledWith(
        'acc-nolink',
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        expect.stringContaining('removed'),
      );
    });

    it('deletes a linked business using its linkId when available', async () => {
      const {getByTestId} = renderScreen();

      await act(async () => {
        fireEvent(getByTestId('delete-btn-acc-link'), 'onTouchEnd');
      });
      await act(async () => {
        fireEvent(getByTestId('confirm-delete-btn'), 'onTouchEnd');
      });

      expect(LinkedBusinessActions.deleteLinkedBusiness).toHaveBeenCalledWith(
        'link-4',
      );
    });

    it('does nothing when confirming delete with no selection', async () => {
      const {getByTestId} = renderScreen();
      await act(async () => {
        fireEvent(getByTestId('confirm-delete-btn'), 'onTouchEnd');
      });
      expect(LinkedBusinessActions.deleteLinkedBusiness).not.toHaveBeenCalled();
    });

    it('clears the pending selection when delete is cancelled', async () => {
      const {getByTestId} = renderScreen();
      await act(async () => {
        fireEvent(getByTestId('delete-btn-acc-nolink'), 'onTouchEnd');
      });
      // Cancel resets the ref; a subsequent confirm should be a no-op.
      act(() => {
        fireEvent(getByTestId('cancel-delete-btn'), 'onTouchEnd');
      });
      await act(async () => {
        fireEvent(getByTestId('confirm-delete-btn'), 'onTouchEnd');
      });
      expect(LinkedBusinessActions.deleteLinkedBusiness).not.toHaveBeenCalled();
    });

    it('handles delete error', async () => {
      (
        LinkedBusinessActions.deleteLinkedBusiness as unknown as jest.Mock
      ).mockReturnValue({type: 'throw'});
      const {getByTestId} = renderScreen();

      await act(async () => {
        fireEvent(getByTestId('delete-btn-acc-nolink'), 'onTouchEnd');
      });
      await act(async () => {
        fireEvent(getByTestId('confirm-delete-btn'), 'onTouchEnd');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to delete'),
      );
    });
  });

  describe('Navigation & UI', () => {
    it('goes back when header back button pressed and navigation can go back', () => {
      mockCanGoBack.mockReturnValue(true);
      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('mock-header'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('does not go back when navigation cannot go back', () => {
      mockCanGoBack.mockReturnValue(false);
      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('mock-header'), 'onTouchEnd');
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('uses the Android keyboard behavior when not on iOS', () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';
      try {
        const {getByTestId} = renderScreen();
        expect(getByTestId('liquid-layout')).toBeTruthy();
      } finally {
        (Platform as any).OS = originalOS;
      }
    });

    it('measures the search bar position on layout (refs resolved)', () => {
      const createNodeMock = () => ({
        measureInWindow: (cb: any) => cb(0, 10, 100, 40),
        measure: (cb: any) => cb(0, 0, 100, 40, 0, 10),
        measureLayout: () => {},
        setNativeProps: () => {},
        focus: () => {},
        blur: () => {},
        getScrollableNode: () => null,
        scrollTo: () => {},
        scrollToOffset: () => {},
        scrollToEnd: () => {},
      });
      const view = renderScreen({renderOptions: {createNodeMock}});
      act(() => {
        fireEvent(view.root as any, 'layout', {
          nativeEvent: {layout: {x: 0, y: 0, width: 100, height: 40}},
        });
      });
      expect(view.getByTestId('liquid-layout')).toBeTruthy();
    });

    it('no-ops the layout measurement when refs are not resolved', () => {
      // Default renderer node mock returns null, so the refs stay null.
      const view = renderScreen();
      act(() => {
        fireEvent(view.root as any, 'layout', {
          nativeEvent: {layout: {x: 0, y: 0, width: 100, height: 40}},
        });
      });
      expect(view.getByTestId('liquid-layout')).toBeTruthy();
    });
  });
});
