import businessesReducer, {
  fetchBusinesses,
  fetchServiceSlots,
  resetBusinessesState,
} from '../../../src/features/appointments/businessesSlice';
import {appointmentApi} from '../../../src/features/appointments/services/appointmentsService';
import * as sessionManager from '../../../src/features/auth/sessionManager';
import {configureStore} from '@reduxjs/toolkit';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '../../../src/features/linkedBusinesses';
import * as photoUtils from '../../../src/features/appointments/utils/photoUtils';

// --- Mocks ---
jest.mock(
  '../../../src/features/appointments/services/appointmentsService',
  () => ({
    appointmentApi: {
      fetchNearbyBusinesses: jest.fn(),
      searchBusinessesByService: jest.fn(),
      fetchBookableSlots: jest.fn(),
    },
  }),
);

jest.mock('../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

jest.mock('../../../src/features/linkedBusinesses', () => ({
  fetchBusinessDetails: {
    fulfilled: {type: 'linkedBusinesses/fetchDetails/fulfilled'},
  },
  fetchGooglePlacesImage: {
    fulfilled: {type: 'linkedBusinesses/fetchImage/fulfilled'},
  },
}));

jest.mock('../../../src/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: jest.fn(),
}));

describe('businessesSlice', () => {
  let store: any;
  const mockInitialState = {
    businesses: [],
    employees: [],
    services: [],
    availability: [],
    loading: false,
    error: null,
  };

  beforeEach(() => {
    store = configureStore({
      reducer: {
        businesses: businessesReducer,
      },
    });
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Initial State & Reset
  // ===========================================================================

  it('should handle initial state', () => {
    expect(businessesReducer(undefined, {type: 'unknown'})).toEqual(
      mockInitialState,
    );
  });

  it('should handle resetBusinessesState', () => {
    const dirtyState = {
      ...mockInitialState,
      loading: true,
      businesses: [{id: '1'} as any],
    };
    expect(businessesReducer(dirtyState, resetBusinessesState())).toEqual(
      mockInitialState,
    );
  });

  // ===========================================================================
  // 2. Async Thunk: fetchBusinesses
  // ===========================================================================

  describe('fetchBusinesses', () => {
    const mockNearbyResponse = {
      businesses: [{id: 'b1', name: 'Vet 1'}],
      services: [{id: 's1', name: 'Service 1'}],
      meta: {page: 1},
    };

    it('should fetch nearby businesses successfully with valid token', async () => {
      // Setup Token
      (sessionManager.getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: 'valid-token',
        expiresAt: 9999999999999,
      });
      (sessionManager.isTokenExpired as jest.Mock).mockReturnValue(false);

      // Setup API
      (appointmentApi.fetchNearbyBusinesses as jest.Mock).mockResolvedValue(
        mockNearbyResponse,
      );

      // Dispatch
      await store.dispatch(fetchBusinesses({lat: 10, lng: 10}));

      const state = store.getState().businesses;
      expect(state.loading).toBe(false);
      expect(state.businesses).toEqual([{id: 'b1', name: 'Vet 1'}]);
      expect(state.services).toEqual([{id: 's1', name: 'Service 1'}]);
      expect(appointmentApi.fetchNearbyBusinesses).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'valid-token',
          lat: 10,
          lng: 10,
        }),
      );
    });

    it('should handle searchBusinessesByService when serviceName provided', async () => {
      // No token scenario (null token)
      (sessionManager.getFreshStoredTokens as jest.Mock).mockResolvedValue(
        null,
      );

      (appointmentApi.fetchNearbyBusinesses as jest.Mock).mockResolvedValue({
        businesses: [],
        services: [],
      });
      (appointmentApi.searchBusinessesByService as jest.Mock).mockResolvedValue(
        {
          businesses: [{id: 'b2', name: 'Search Vet'}],
          services: [{id: 's2', name: 'Search Service'}],
        },
      );

      await store.dispatch(fetchBusinesses({serviceName: 'Grooming'}));

      const state = store.getState().businesses;
      expect(state.businesses).toHaveLength(1);
      expect(state.businesses[0].name).toBe('Search Vet');
      expect(appointmentApi.searchBusinessesByService).toHaveBeenCalledWith(
        expect.objectContaining({serviceName: 'Grooming'}),
      );
    });

    it('should deduplicate businesses and services by ID', async () => {
      (sessionManager.getFreshStoredTokens as jest.Mock).mockRejectedValue(
        new Error('Token error'), // Logic should catch and return null
      );

      (appointmentApi.fetchNearbyBusinesses as jest.Mock).mockResolvedValue({
        businesses: [
          {id: 'b1', name: 'Vet 1'},
          {id: 'b1', name: 'Vet 1 Dup'},
        ],
        services: [
          {id: 's1', name: 'Svc 1'},
          {id: 's1', name: 'Svc 1 Dup'},
        ],
      });

      await store.dispatch(fetchBusinesses(undefined)); // Test undefined params fallback

      const state = store.getState().businesses;
      // Should prefer the later object in the array due to spread logic
      expect(state.businesses).toHaveLength(1);
      expect(state.businesses[0].name).toBe('Vet 1 Dup');
      expect(state.services).toHaveLength(1);
    });

    it('should handle API errors correctly (Error object)', async () => {
      (appointmentApi.fetchNearbyBusinesses as jest.Mock).mockRejectedValue(
        new Error('API Failure'),
      );

      await store.dispatch(fetchBusinesses(undefined));

      const state = store.getState().businesses;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('API Failure');
    });

    it('should handle API errors correctly (Non-Error string)', async () => {
      (appointmentApi.fetchNearbyBusinesses as jest.Mock).mockRejectedValue(
        'Unknown Error',
      );

      await store.dispatch(fetchBusinesses(undefined));
    });

    it('should handle API errors correctly (Unknown object fallback)', async () => {
      // Mocking a reject that isn't an Error instance and empty string/null to trigger fallback
      (appointmentApi.fetchNearbyBusinesses as jest.Mock).mockRejectedValue({});

      await store.dispatch(fetchBusinesses(undefined));
      const state = store.getState().businesses;
      expect(state.error).toBe('Failed to fetch businesses');
    });

    it('should treat expired token as null', async () => {
      (sessionManager.getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: 'expired-token',
        expiresAt: 1000,
      });
      (sessionManager.isTokenExpired as jest.Mock).mockReturnValue(true);
      (appointmentApi.fetchNearbyBusinesses as jest.Mock).mockResolvedValue(
        mockNearbyResponse,
      );

      await store.dispatch(fetchBusinesses(undefined));

      expect(appointmentApi.fetchNearbyBusinesses).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: undefined })
      );
    });
  });

  // ===========================================================================
  // 3. Async Thunk: fetchServiceSlots
  // ===========================================================================

  describe('fetchServiceSlots', () => {
    const mockArgs = {businessId: 'b1', serviceId: 's1', date: '2023-10-10'};

    it('should fetch slots successfully and normalize dates', async () => {
      const mockWindows = [
        {startTime: '10:00', endTime: '11:00'}, // Standard
        {start: '12:00', end: '13:00'}, // Fallback properties logic test
      ];

      (appointmentApi.fetchBookableSlots as jest.Mock).mockResolvedValue({
        date: '2023-10-10',
        windows: mockWindows,
      });

      await store.dispatch(fetchServiceSlots(mockArgs));

      const state = store.getState().businesses;
      const av = state.availability[0];

      expect(av).toBeDefined();
      expect(av.businessId).toBe('b1');
      expect(av.slotsByDate['2023-10-10']).toHaveLength(2);

      // Verify normalization logic (startLocal/endLocal/etc)
      const slot1 = av.slotsByDate['2023-10-10'][0];
      expect(slot1.startTime).toBeDefined();
      expect(slot1.startTimeUtc).toBeDefined(); // Should have ISO string
    });

    it('should handle empty windows', async () => {
      (appointmentApi.fetchBookableSlots as jest.Mock).mockResolvedValue({
        date: '2023-10-10',
        windows: [],
      });

      await store.dispatch(fetchServiceSlots(mockArgs));
      const state = store.getState().businesses;
      expect(state.availability[0].slotsByDate['2023-10-10']).toEqual([]);
    });

    it('should update existing availability entry', async () => {
      // Preload state
      const preloadedState = {
        businesses: {
          ...mockInitialState,
          availability: [
            {
              businessId: 'b1',
              serviceId: 's1',
              slotsByDate: {'2023-10-09': []},
            },
          ],
        },
      };
      store = configureStore({
        reducer: {businesses: businessesReducer},
        preloadedState,
      });

      (appointmentApi.fetchBookableSlots as jest.Mock).mockResolvedValue({
        date: '2023-10-10',
        windows: [{startTime: '09:00', endTime: '10:00'}],
      });

      await store.dispatch(fetchServiceSlots(mockArgs));

      const state = store.getState().businesses;
      expect(state.availability).toHaveLength(1); // Should not push new one
      expect(state.availability[0].slotsByDate['2023-10-09']).toBeDefined();
      expect(state.availability[0].slotsByDate['2023-10-10']).toHaveLength(1);
    });

    it('should handle error in fetchServiceSlots', async () => {
      (appointmentApi.fetchBookableSlots as jest.Mock).mockRejectedValue(
        new Error('Slot Error'),
      );
      const result = await store.dispatch(fetchServiceSlots(mockArgs));
      expect(result.type).toBe('businesses/fetchServiceSlots/rejected');
      expect(result.payload).toBe('Slot Error');
    });

    // --- Private Helper Coverage: toDateFromTime & normalizeSlotsToLocal ---

    it('should handle invalid date parsing fallback in normalization', async () => {
      // Mock windows that trigger the NaN logic in toDateFromTime
      // Case: Time string provided but format causes split issues or Date.UTC fails
      // We simulate this by passing a time string that toDateFromTime logic might struggle with
      // effectively covering the "some(n => isNaN(n))" branch.
      const weirdWindows = [
        {startTime: 'invalid-time', endTime: 'invalid-time'},
      ];

      (appointmentApi.fetchBookableSlots as jest.Mock).mockResolvedValue({
        date: '2023-10-10',
        windows: weirdWindows,
      });

      await store.dispatch(fetchServiceSlots(mockArgs));

      const state = store.getState().businesses;
      const slots = state.availability[0].slotsByDate['2023-10-10'];

      // If parsing fails, toDateFromTime returns null.
      // toLocalTimeString(null) returns null.
      // logic: startLocal ?? window.startTime
      expect(slots[0].startTime).toBe('invalid-time'); // Fallback used
      expect(slots[0].startTimeUtc).toBeUndefined(); // null date -> toISOString undefined check
    });

    it('should handle time is null in toDateFromTime', async () => {
      // Covering `if (!time) return null;`
      const windowsWithNoTime = [{startTime: null, endTime: null}];
      (appointmentApi.fetchBookableSlots as jest.Mock).mockResolvedValue({
        date: '2023-10-10',
        windows: windowsWithNoTime,
      });
      await store.dispatch(fetchServiceSlots(mockArgs));
      const slots = store.getState().businesses.availability[0].slotsByDate['2023-10-10'];
      expect(slots[0].startTime).toBe(''); // fallback in normalize: startLocal ?? ''
    });

    it('should handle end fallback to startTime', async () => {
       // logic: const endLocal = ... ?? window.endTime ?? window.startTime;
       const windows = [{startTime: '10:00'}]; // No endTime
       (appointmentApi.fetchBookableSlots as jest.Mock).mockResolvedValue({
        date: '2023-10-10',
        windows,
      });
      await store.dispatch(fetchServiceSlots(mockArgs));
      const slots = store.getState().businesses.availability[0].slotsByDate['2023-10-10'];
      // The logic tries to calculate endDate using window.startTime if endTime is missing
      expect(slots[0].endTime).toBeTruthy();
    });
  });

  // ===========================================================================
  // 4. Extra Reducers: Business Details & Images
  // ===========================================================================

  describe('fetchBusinessDetails.fulfilled', () => {
    it('should ignore if placeId is missing', () => {
      const initialState = {
        ...mockInitialState,
        businesses: [{id: 'b1', googlePlacesId: 'gp1'} as any],
      };
      const action = {
        type: fetchBusinessDetails.fulfilled.type,
        payload: {placeId: null},
      };
      const nextState = businessesReducer(initialState, action);
      expect(nextState).toEqual(initialState);
    });

    it('should update business photo/phone/website if found', () => {
      (photoUtils.isDummyPhoto as jest.Mock).mockReturnValue(true); // Treat existing as dummy

      const initialState = {
        ...mockInitialState,
        businesses: [
          {
            id: 'b1',
            googlePlacesId: 'gp1',
            photo: 'dummy.png',
            phone: '',
            website: '',
          } as any,
        ],
      };

      const action = {
        type: fetchBusinessDetails.fulfilled.type,
        payload: {
          placeId: 'gp1',
          photoUrl: 'new-photo.jpg',
          phoneNumber: '1234567890',
          website: 'example.com',
        },
      };

      const nextState = businessesReducer(initialState, action);
      const biz = nextState.businesses[0];

      expect(biz.photo).toBe('new-photo.jpg');
      expect(biz.phone).toBe('1234567890');
      expect(biz.website).toBe('example.com');
    });

    it('should not overwrite non-dummy photo', () => {
      (photoUtils.isDummyPhoto as jest.Mock).mockReturnValue(false); // Valid photo

      const initialState = {
        ...mockInitialState,
        businesses: [
          {
            id: 'b1',
            googlePlacesId: 'gp1',
            photo: 'valid.jpg',
          } as any,
        ],
      };

      const action = {
        type: fetchBusinessDetails.fulfilled.type,
        payload: {placeId: 'gp1', photoUrl: 'new.jpg'},
      };

      const nextState = businessesReducer(initialState, action);
      expect(nextState.businesses[0].photo).toBe('valid.jpg');
    });
  });

  describe('fetchGooglePlacesImage.fulfilled', () => {
    it('should ignore if photoUrl is missing', () => {
      const initialState = {
        ...mockInitialState,
        businesses: [{id: 'b1'} as any],
      };
      const action = {
        type: fetchGooglePlacesImage.fulfilled.type,
        payload: {photoUrl: null},
      };
      const nextState = businessesReducer(initialState, action);
      expect(nextState).toEqual(initialState);
    });

    it('should update businesses with missing or dummy photos', () => {
      (photoUtils.isDummyPhoto as jest.Mock).mockImplementation(
        url => url === 'dummy.png',
      );

      const initialState = {
        ...mockInitialState,
        businesses: [
          {id: 'b1', photo: null} as any,
          {id: 'b2', photo: 'dummy.png'} as any,
          {id: 'b3', photo: 'valid.png'} as any,
        ],
      };

      const action = {
        type: fetchGooglePlacesImage.fulfilled.type,
        payload: {photoUrl: 'google-image.jpg'},
      };

      const nextState = businessesReducer(initialState, action);

      expect(nextState.businesses[0].photo).toBe('google-image.jpg'); // Was null
      expect(nextState.businesses[1].photo).toBe('google-image.jpg'); // Was dummy
      expect(nextState.businesses[2].photo).toBe('valid.png'); // Was valid
    });
  });
});