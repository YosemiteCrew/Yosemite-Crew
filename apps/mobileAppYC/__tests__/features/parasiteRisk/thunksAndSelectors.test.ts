const mockService = {
  fetchRiskForLocation: jest.fn(),
  fetchSubscriptions: jest.fn(),
  createSubscription: jest.fn(),
  removeSubscription: jest.fn(),
};

jest.mock('@/features/parasiteRisk/services/parasiteRiskService', () => ({
  fetchRiskForLocation: (...a: unknown[]) =>
    mockService.fetchRiskForLocation(...a),
  fetchSubscriptions: (...a: unknown[]) => mockService.fetchSubscriptions(...a),
  createSubscription: (...a: unknown[]) => mockService.createSubscription(...a),
  removeSubscription: (...a: unknown[]) => mockService.removeSubscription(...a),
}));

import {
  followLocation,
  loadRiskForLocation,
  loadSubscriptions,
  unfollowLocation,
} from '@/features/parasiteRisk/thunks';
import {
  selectDisclaimerAcknowledged,
  selectHeadlineReading,
  selectIsCurrentLocationFollowed,
  selectReadingForParasite,
  selectRecentRiskLocations,
  selectRiskError,
  selectRiskLoading,
  selectRiskLocation,
  selectRiskReading,
  selectRiskReadings,
  selectRiskSubscriptions,
} from '@/features/parasiteRisk/selectors';
import {parasiteRiskInitialState} from '@/features/parasiteRisk/parasiteRiskSlice';
import type {RootState} from '@/app/store';

const brisbane = {
  label: 'Brisbane',
  lat: -27.375,
  lon: 153.125,
  countryCode: 'AU',
};

const dispatchThunk = async (thunk: any, arg?: unknown) => {
  const dispatch = jest.fn();
  const getState = jest.fn();
  return thunk(arg)(dispatch, getState, undefined);
};

describe('parasiteRisk thunks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the location alongside the reading on success', async () => {
    mockService.fetchRiskForLocation.mockResolvedValue({overallTier: 'HIGH'});

    const action = await dispatchThunk(loadRiskForLocation, brisbane);

    expect(action.payload).toEqual({
      location: brisbane,
      reading: {overallTier: 'HIGH'},
    });
  });

  it('rejects with a localizable key when the lookup fails', async () => {
    mockService.fetchRiskForLocation.mockRejectedValue(new Error('offline'));

    const action = await dispatchThunk(loadRiskForLocation, brisbane);
    expect(action.payload).toBe('parasiteRisk.errors.forecast');
  });

  it('falls back to a readable message when the error has none', async () => {
    mockService.fetchRiskForLocation.mockRejectedValue(new Error(''));

    const action = await dispatchThunk(loadRiskForLocation, brisbane);
    expect(action.payload).toBe('parasiteRisk.errors.forecast');
  });

  it('loads subscriptions', async () => {
    mockService.fetchSubscriptions.mockResolvedValue([{id: 'sub-1'}]);

    const action = await dispatchThunk(loadSubscriptions);
    expect(action.payload).toEqual([{id: 'sub-1'}]);
  });

  it('reports a subscription load failure', async () => {
    mockService.fetchSubscriptions.mockRejectedValue(new Error(''));

    const action = await dispatchThunk(loadSubscriptions);
    expect(action.payload).toBe('parasiteRisk.errors.subscriptions');
  });

  it('follows a location', async () => {
    mockService.createSubscription.mockResolvedValue({id: 'sub-1'});

    const action = await dispatchThunk(followLocation, {location: brisbane});
    expect(action.payload).toEqual({id: 'sub-1'});
  });

  it('reports a follow failure', async () => {
    mockService.createSubscription.mockRejectedValue(new Error(''));

    const action = await dispatchThunk(followLocation, {location: brisbane});
    expect(action.payload).toBe('parasiteRisk.errors.follow');
  });

  it('returns the id it unfollowed so the slice can drop it', async () => {
    mockService.removeSubscription.mockResolvedValue(undefined);

    const action = await dispatchThunk(unfollowLocation, 'sub-1');
    expect(action.payload).toBe('sub-1');
  });

  it('reports an unfollow failure', async () => {
    mockService.removeSubscription.mockRejectedValue(new Error(''));

    const action = await dispatchThunk(unfollowLocation, 'sub-1');
    expect(action.payload).toBe('parasiteRisk.errors.unfollow');
  });
});

describe('parasiteRisk selectors', () => {
  const stateWith = (overrides = {}): RootState =>
    ({
      parasiteRisk: {...parasiteRiskInitialState, ...overrides},
    }) as unknown as RootState;

  const readings = [
    {
      parasiteId: 'paralysis_tick',
      group: 'TICK',
      index: 70,
      tier: 'HIGH',
      trend: 'STEADY',
    },
    {
      parasiteId: 'flea',
      group: 'FLEA',
      index: 30,
      tier: 'MODERATE',
      trend: 'STEADY',
    },
  ];

  it('reads the empty defaults without throwing', () => {
    const state = stateWith();

    expect(selectRiskLocation(state)).toBeNull();
    expect(selectRiskReading(state)).toBeNull();
    expect(selectRiskReadings(state)).toEqual([]);
    expect(selectHeadlineReading(state)).toBeNull();
    expect(selectRiskLoading(state)).toBe(false);
    expect(selectRiskError(state)).toBeNull();
    expect(selectRecentRiskLocations(state)).toEqual([]);
    expect(selectRiskSubscriptions(state)).toEqual([]);
    expect(selectDisclaimerAcknowledged(state)).toBe(false);
  });

  it('takes the headline from the first reading', () => {
    const state = stateWith({reading: {readings}});
    expect(selectHeadlineReading(state)?.parasiteId).toBe('paralysis_tick');
  });

  it('finds a reading by parasite, and returns null when absent', () => {
    const state = stateWith({reading: {readings}});

    expect(selectReadingForParasite('flea')(state)?.index).toBe(30);
    expect(selectReadingForParasite('lungworm')(state)).toBeNull();
    expect(selectReadingForParasite(null)(state)).toBeNull();
  });

  it('knows whether the current location is already followed', () => {
    expect(selectIsCurrentLocationFollowed(stateWith())).toBe(false);

    expect(
      selectIsCurrentLocationFollowed(
        stateWith({
          location: brisbane,
          subscriptions: [
            {id: 's1', label: 'Different label', lat: -27.375, lon: 153.125},
          ],
        }),
      ),
    ).toBe(true);

    expect(
      selectIsCurrentLocationFollowed(
        stateWith({
          location: brisbane,
          subscriptions: [
            {id: 's1', label: 'Brisbane', lat: 41.875, lon: 12.5},
          ],
        }),
      ),
    ).toBe(false);
  });
});
