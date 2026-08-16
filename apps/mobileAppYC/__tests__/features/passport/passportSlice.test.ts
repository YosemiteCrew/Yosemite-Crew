import reducer, {
  fetchPassport,
  clearPassportError,
} from '@/features/passport/passportSlice';
import {passportApi} from '@/features/passport/services/passportService';

jest.mock('@/features/passport/services/passportService', () => ({
  passportApi: {
    fetchPassport: jest.fn(),
  },
}));

describe('passportSlice', () => {
  const initialState = {
    byCompanionId: {},
    loading: false,
    error: null,
  };

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
  });

  it('returns the initial state', () => {
    expect(reducer(undefined, {type: 'unknown'})).toEqual(initialState);
  });

  it('clearPassportError clears the error field', () => {
    const state = {...initialState, error: 'boom'};
    expect(reducer(state, clearPassportError())).toEqual({
      ...initialState,
      error: null,
    });
  });

  describe('fetchPassport thunk', () => {
    it('sets loading true on pending', () => {
      const state = reducer(initialState, {type: fetchPassport.pending.type});
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('stores the passport keyed by companionId on fulfilled', () => {
      const state = reducer(initialState, {
        type: fetchPassport.fulfilled.type,
        payload: {companionId: 'companion-123', passport: mockPassport},
      });
      expect(state.loading).toBe(false);
      expect(state.byCompanionId['companion-123']).toEqual(mockPassport);
    });

    it('drops any cached passport when fulfilled with no issued passport', () => {
      const state = reducer(
        {
          ...initialState,
          byCompanionId: {'companion-123': mockPassport},
        },
        {
          type: fetchPassport.fulfilled.type,
          payload: {companionId: 'companion-123', passport: null},
        },
      );
      expect(state.loading).toBe(false);
      expect(state.byCompanionId['companion-123']).toBeUndefined();
      expect(state.error).toBeNull();
    });

    it('sets the error message on rejected', () => {
      const state = reducer(initialState, {
        type: fetchPassport.rejected.type,
        payload: 'Failed to load passport',
        error: {message: 'Failed to load passport'},
      });
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to load passport');
    });

    it('falls back to action.error.message when no rejectValue payload is present', () => {
      const state = reducer(initialState, {
        type: fetchPassport.rejected.type,
        payload: undefined,
        error: {message: 'Network error'},
      });
      expect(state.error).toBe('Network error');
    });

    it('falls back to null when neither payload nor error.message is present', () => {
      const state = reducer(initialState, {
        type: fetchPassport.rejected.type,
        payload: undefined,
        error: {},
      });
      expect(state.error).toBeNull();
    });

    it('rejects with a message when companionId is missing', async () => {
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: ''});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.payload).toBe('Please select a pet to view the passport.');
      expect(passportApi.fetchPassport).not.toHaveBeenCalled();
    });

    it('calls passportApi.fetchPassport and dispatches fulfilled on success', async () => {
      (passportApi.fetchPassport as jest.Mock).mockResolvedValue(mockPassport);
      const dispatch = jest.fn();
      const thunk = fetchPassport({companionId: 'companion-123'});
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(passportApi.fetchPassport).toHaveBeenCalledWith('companion-123');
      expect(result.payload).toEqual({
        companionId: 'companion-123',
        passport: mockPassport,
      });
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
