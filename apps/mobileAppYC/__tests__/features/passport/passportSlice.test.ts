import reducer, {
  fetchPassport,
  clearPassportError,
  resetPassportState,
  ensurePassportAccessToken,
} from '@/features/passport/passportSlice';
import {passportApi} from '@/features/passport/services/passportService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';

jest.mock('@/features/passport/services/passportService', () => ({
  passportApi: {
    fetchPassport: jest.fn(),
  },
}));

jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

const mockGetFreshStoredTokens = getFreshStoredTokens as jest.Mock;
const mockIsTokenExpired = isTokenExpired as jest.Mock;

describe('passportSlice', () => {
  const initialState = {
    byCompanionId: {},
    loadingByCompanionId: {},
    errorByCompanionId: {},
  };

  // The lifecycle reducers key off action.meta.arg, so raw dispatches in these
  // tests have to carry the same meta the real thunk attaches.
  const lifecycle = (
    type: string,
    companionId: string,
    rest: Record<string, unknown> = {},
  ) => ({type, meta: {arg: {companionId}}, ...rest});

  const mockAccessToken = 'mock-access-token';
  const mockExpiresAt = 1893456000000;

  const mockPassport = {
    identity: {
      id: 'companion-123',
      name: 'Rex',
      species: 'DOG',
      breed: 'Labrador',
      sex: 'Male',
    },
    vaccinations: [],
    parasiteTreatments: [],
    rabiesTitrations: [],
    clinicalExams: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFreshStoredTokens.mockResolvedValue({
      accessToken: mockAccessToken,
      expiresAt: mockExpiresAt,
    });
    mockIsTokenExpired.mockReturnValue(false);
  });

  it('returns the initial state', () => {
    expect(reducer(undefined, {type: 'unknown'})).toEqual(initialState);
  });

  it('clearPassportError clears only the addressed companion error', () => {
    const state = {
      ...initialState,
      errorByCompanionId: {'companion-123': 'boom', 'companion-456': 'bang'},
    };
    expect(reducer(state, clearPassportError('companion-123'))).toEqual({
      ...initialState,
      errorByCompanionId: {'companion-456': 'bang'},
    });
  });

  // Passport payloads carry the owner's name, email and phone, so an in-session
  // account switch must not leave the previous account's cache behind.
  it('resetPassportState wipes every cached passport and request flag', () => {
    const state = {
      byCompanionId: {'companion-123': mockPassport},
      loadingByCompanionId: {'companion-123': true},
      errorByCompanionId: {'companion-456': 'boom'},
    };
    expect(reducer(state, resetPassportState())).toEqual(initialState);
  });

  // The passport routes are authenticated and apiClient attaches nothing on its
  // own, so a missing/expired credential has to surface as an error instead of
  // letting an unauthenticated request through.
  describe('ensurePassportAccessToken', () => {
    it('returns the stored access token when the session is still valid', async () => {
      await expect(ensurePassportAccessToken()).resolves.toBe(mockAccessToken);
      expect(mockIsTokenExpired).toHaveBeenCalledWith(mockExpiresAt);
    });

    it('throws when there is no stored session at all', async () => {
      mockGetFreshStoredTokens.mockResolvedValue(null);

      await expect(ensurePassportAccessToken()).rejects.toThrow(
        'Missing access token. Please sign in again.',
      );
      expect(mockIsTokenExpired).not.toHaveBeenCalled();
    });

    it('throws when the stored session carries no access token', async () => {
      mockGetFreshStoredTokens.mockResolvedValue({
        accessToken: '',
        expiresAt: mockExpiresAt,
      });

      await expect(ensurePassportAccessToken()).rejects.toThrow(
        'Missing access token. Please sign in again.',
      );
    });

    it('throws when the stored access token has expired', async () => {
      mockIsTokenExpired.mockReturnValue(true);

      await expect(ensurePassportAccessToken()).rejects.toThrow(
        'Your session expired. Please sign in again.',
      );
    });

    it('checks expiry with undefined when the session has no expiry timestamp', async () => {
      mockGetFreshStoredTokens.mockResolvedValue({
        accessToken: mockAccessToken,
        expiresAt: null,
      });

      await expect(ensurePassportAccessToken()).resolves.toBe(mockAccessToken);
      expect(mockIsTokenExpired).toHaveBeenCalledWith(undefined);
    });
  });

  describe('fetchPassport thunk', () => {
    it('flags only the requested companion as loading on pending', () => {
      const state = reducer(
        {
          ...initialState,
          errorByCompanionId: {
            'companion-123': 'stale',
            'companion-456': 'keep',
          },
        },
        lifecycle(fetchPassport.pending.type, 'companion-123'),
      );
      expect(state.loadingByCompanionId['companion-123']).toBe(true);
      expect(state.loadingByCompanionId['companion-456']).toBeUndefined();
      expect(state.errorByCompanionId['companion-123']).toBeUndefined();
      expect(state.errorByCompanionId['companion-456']).toBe('keep');
    });

    it('stores the passport keyed by companionId on fulfilled', () => {
      const state = reducer(
        initialState,
        lifecycle(fetchPassport.fulfilled.type, 'companion-123', {
          payload: {companionId: 'companion-123', passport: mockPassport},
        }),
      );
      expect(state.loadingByCompanionId['companion-123']).toBe(false);
      expect(state.byCompanionId['companion-123']).toEqual(mockPassport);
    });

    it('drops any cached passport when fulfilled with no issued passport', () => {
      const state = reducer(
        {
          ...initialState,
          byCompanionId: {'companion-123': mockPassport},
        },
        lifecycle(fetchPassport.fulfilled.type, 'companion-123', {
          payload: {companionId: 'companion-123', passport: null},
        }),
      );
      expect(state.loadingByCompanionId['companion-123']).toBe(false);
      expect(state.byCompanionId['companion-123']).toBeUndefined();
      expect(state.errorByCompanionId['companion-123']).toBeUndefined();
    });

    it('sets the error message on rejected', () => {
      const state = reducer(
        initialState,
        lifecycle(fetchPassport.rejected.type, 'companion-123', {
          payload: 'Failed to load passport',
          error: {message: 'Failed to load passport'},
        }),
      );
      expect(state.loadingByCompanionId['companion-123']).toBe(false);
      expect(state.errorByCompanionId['companion-123']).toBe(
        'Failed to load passport',
      );
    });

    // Backing out of pet A into pet B leaves A's request in flight; when it
    // later fails it must not paint an error over B's screen.
    it('confines a late rejection to the companion it was requested for', () => {
      const afterBPending = reducer(
        initialState,
        lifecycle(fetchPassport.pending.type, 'companion-b'),
      );
      const afterALateRejection = reducer(
        afterBPending,
        lifecycle(fetchPassport.rejected.type, 'companion-a', {
          payload: 'Your session expired. Please sign in again.',
          error: {message: 'Your session expired. Please sign in again.'},
        }),
      );

      expect(afterALateRejection.errorByCompanionId['companion-a']).toBe(
        'Your session expired. Please sign in again.',
      );
      expect(
        afterALateRejection.errorByCompanionId['companion-b'],
      ).toBeUndefined();
      expect(afterALateRejection.loadingByCompanionId['companion-b']).toBe(
        true,
      );
    });

    it('confines a late fulfilment to the companion it was requested for', () => {
      const afterBPending = reducer(
        initialState,
        lifecycle(fetchPassport.pending.type, 'companion-b'),
      );
      const afterALateFulfilment = reducer(
        afterBPending,
        lifecycle(fetchPassport.fulfilled.type, 'companion-a', {
          payload: {companionId: 'companion-a', passport: mockPassport},
        }),
      );

      expect(afterALateFulfilment.byCompanionId['companion-a']).toEqual(
        mockPassport,
      );
      expect(afterALateFulfilment.byCompanionId['companion-b']).toBeUndefined();
      expect(afterALateFulfilment.loadingByCompanionId['companion-b']).toBe(
        true,
      );
    });

    it('falls back to action.error.message when no rejectValue payload is present', () => {
      const state = reducer(
        initialState,
        lifecycle(fetchPassport.rejected.type, 'companion-123', {
          payload: undefined,
          error: {message: 'Network error'},
        }),
      );
      expect(state.errorByCompanionId['companion-123']).toBe('Network error');
    });

    it('falls back to null when neither payload nor error.message is present', () => {
      const state = reducer(
        initialState,
        lifecycle(fetchPassport.rejected.type, 'companion-123', {
          payload: undefined,
          error: {},
        }),
      );
      expect(state.errorByCompanionId['companion-123']).toBeNull();
    });

    it('rejects with a message when companionId is missing', async () => {
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: ''});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.payload).toBe('Please select a pet to view the passport.');
      expect(passportApi.fetchPassport).not.toHaveBeenCalled();
      expect(mockGetFreshStoredTokens).not.toHaveBeenCalled();
    });

    it('calls passportApi.fetchPassport with the resolved access token and dispatches fulfilled on success', async () => {
      (passportApi.fetchPassport as jest.Mock).mockResolvedValue(mockPassport);
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: 'companion-123'});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(passportApi.fetchPassport).toHaveBeenCalledWith(
        'companion-123',
        mockAccessToken,
      );
      expect(result.payload).toEqual({
        companionId: 'companion-123',
        passport: mockPassport,
      });
    });

    it('rejects without calling the API when no access token is stored', async () => {
      mockGetFreshStoredTokens.mockResolvedValue(null);
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: 'companion-123'});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.type).toBe(fetchPassport.rejected.type);
      expect(result.payload).toBe(
        'Missing access token. Please sign in again.',
      );
      expect(passportApi.fetchPassport).not.toHaveBeenCalled();
    });

    it('rejects without calling the API when the stored session has expired', async () => {
      mockIsTokenExpired.mockReturnValue(true);
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: 'companion-123'});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.type).toBe(fetchPassport.rejected.type);
      expect(result.payload).toBe(
        'Your session expired. Please sign in again.',
      );
      expect(passportApi.fetchPassport).not.toHaveBeenCalled();
    });

    it('dispatches rejected with the error message on API failure', async () => {
      (passportApi.fetchPassport as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: 'companion-123'});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.payload).toBe('Network error');
    });

    it('fulfils with a null passport when the backend 404s (none issued yet)', async () => {
      (passportApi.fetchPassport as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Request failed with status code 404'), {
          isAxiosError: true,
          response: {status: 404},
        }),
      );
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: 'companion-123'});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.type).toBe(fetchPassport.fulfilled.type);
      expect(result.payload).toEqual({
        companionId: 'companion-123',
        passport: null,
      });
    });

    it('still rejects on non-404 API errors', async () => {
      (passportApi.fetchPassport as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Server error'), {
          isAxiosError: true,
          response: {status: 500},
        }),
      );
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: 'companion-123'});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.type).toBe(fetchPassport.rejected.type);
      expect(result.payload).toBe('Server error');
    });

    it('falls back to a generic message when the thrown error is not an Error instance', async () => {
      (passportApi.fetchPassport as jest.Mock).mockRejectedValue('boom');
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: 'companion-123'});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.payload).toBe('Failed to load passport');
    });
  });
});
