import {renderHook} from '@testing-library/react-native';
import {useFetchOrgRatingIfNeeded} from '../../../../src/features/appointments/hooks/useOrganisationRating';
import {appointmentApi} from '../../../../src/features/appointments/services/appointmentsService';
import {getFreshStoredTokens, isTokenExpired} from '../../../../src/features/auth/sessionManager';

// --- Mocks ---

jest.mock('../../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

jest.mock('../../../../src/features/appointments/services/appointmentsService', () => ({
  appointmentApi: {
    getOrganisationRatingStatus: jest.fn(),
  },
}));

jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('useFetchOrgRatingIfNeeded', () => {
  const mockSetOrgRatings = jest.fn();
  const mockOrgId = 'org-1';
  const mockToken = 'valid-token';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: mockToken,
      expiresAt: Date.now() + 10000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  // =========================================================================
  // 1. Skipping Logic
  // =========================================================================
  describe('Skipping Logic', () => {
    it('does nothing if organisationId is missing', async () => {
      const {result} = renderHook(() =>
        useFetchOrgRatingIfNeeded({
          orgRatings: {},
          setOrgRatings: mockSetOrgRatings,
        }),
      );

      await result.current(null);
      await result.current(undefined);

      expect(mockSetOrgRatings).not.toHaveBeenCalled();
      expect(appointmentApi.getOrganisationRatingStatus).not.toHaveBeenCalled();
    });

    it('does nothing if rating is currently loading', async () => {
      const {result} = renderHook(() =>
        useFetchOrgRatingIfNeeded({
          orgRatings: {[mockOrgId]: {isRated: false, loading: true}},
          setOrgRatings: mockSetOrgRatings,
        }),
      );

      await result.current(mockOrgId);

      expect(mockSetOrgRatings).not.toHaveBeenCalled();
      expect(appointmentApi.getOrganisationRatingStatus).not.toHaveBeenCalled();
    });

    it('does nothing if rating is already fetched (isRated is boolean)', async () => {
      const {result} = renderHook(() =>
        useFetchOrgRatingIfNeeded({
          orgRatings: {[mockOrgId]: {isRated: true, rating: 5}},
          setOrgRatings: mockSetOrgRatings,
        }),
      );

      await result.current(mockOrgId);

      expect(mockSetOrgRatings).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Authentication Handling
  // =========================================================================
  describe('Authentication Handling', () => {
    it('stops loading and sets unrated if tokens are missing', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);

      const {result} = renderHook(() =>
        useFetchOrgRatingIfNeeded({
          orgRatings: {},
          setOrgRatings: mockSetOrgRatings,
        }),
      );

      await result.current(mockOrgId);

      // 1. Set Loading True
      // 2. Set Loading False + Unrated
      expect(mockSetOrgRatings).toHaveBeenCalledTimes(2);

      const lastCall = mockSetOrgRatings.mock.calls[1][0];
      const nextState = lastCall({});
      expect(nextState[mockOrgId]).toEqual({isRated: false, loading: false});

      expect(appointmentApi.getOrganisationRatingStatus).not.toHaveBeenCalled();
    });

    it('stops loading and sets unrated if token is expired', async () => {
      (isTokenExpired as jest.Mock).mockReturnValue(true);

      const {result} = renderHook(() =>
        useFetchOrgRatingIfNeeded({
          orgRatings: {},
          setOrgRatings: mockSetOrgRatings,
        }),
      );

      await result.current(mockOrgId);

      expect(appointmentApi.getOrganisationRatingStatus).not.toHaveBeenCalled();

      // Verify cleanup state
      const updater = mockSetOrgRatings.mock.calls[1][0];
      expect(updater({})[mockOrgId]).toEqual({isRated: false, loading: false});
    });
  });

  // =========================================================================
  // 3. Successful Fetch
  // =========================================================================
  describe('Successful Fetch', () => {
    it('calls API and updates state with result', async () => {
      const mockApiResponse = {isRated: true, rating: 4, review: 'Good'};
      (appointmentApi.getOrganisationRatingStatus as jest.Mock).mockResolvedValue(mockApiResponse);

      const {result} = renderHook(() =>
        useFetchOrgRatingIfNeeded({
          orgRatings: {},
          setOrgRatings: mockSetOrgRatings,
        }),
      );

      await result.current(mockOrgId);

      // 1. Loading set to true
      const loadingUpdater = mockSetOrgRatings.mock.calls[0][0];
      expect(loadingUpdater({})[mockOrgId].loading).toBe(true);

      // 2. API Call
      expect(appointmentApi.getOrganisationRatingStatus).toHaveBeenCalledWith({
        organisationId: mockOrgId,
        accessToken: mockToken,
      });

      // 3. Success Update
      const successUpdater = mockSetOrgRatings.mock.calls[1][0];
      expect(successUpdater({})[mockOrgId]).toEqual({
        ...mockApiResponse,
        loading: false,
      });
    });
  });

  // =========================================================================
  // 4. Error Handling
  // =========================================================================
  describe('Error Handling', () => {
    it('catches API errors, logs warning, and resets loading state', async () => {
      const mockError = new Error('Network fail');
      (appointmentApi.getOrganisationRatingStatus as jest.Mock).mockRejectedValue(mockError);

      const {result} = renderHook(() =>
        useFetchOrgRatingIfNeeded({
          orgRatings: {},
          setOrgRatings: mockSetOrgRatings,
          logTag: 'TestTag',
        }),
      );

      await result.current(mockOrgId);

      expect(console.warn).toHaveBeenCalledWith(
        '[TestTag] Failed to fetch rating status',
        mockError,
      );

      const cleanupUpdater = mockSetOrgRatings.mock.calls[1][0];
      expect(cleanupUpdater({})[mockOrgId]).toEqual({
        isRated: false,
        loading: false,
      });
    });
  });
});