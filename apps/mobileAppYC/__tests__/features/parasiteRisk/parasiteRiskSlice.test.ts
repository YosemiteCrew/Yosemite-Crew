import {
  parasiteRiskReducer,
  parasiteRiskInitialState,
  acknowledgeDisclaimer,
  clearParasiteRiskError,
  resetParasiteRiskState,
} from '@/features/parasiteRisk/parasiteRiskSlice';
import {
  followLocation,
  loadRiskForLocation,
  loadSubscriptions,
  unfollowLocation,
} from '@/features/parasiteRisk/thunks';
import type {
  ParasiteRiskCellReading,
  RiskLocation,
} from '@/features/parasiteRisk/types';

const brisbane: RiskLocation = {
  label: 'Brisbane',
  lat: -27.375,
  lon: 153.125,
  countryCode: 'AU',
};

const rome: RiskLocation = {
  label: 'Rome',
  lat: 41.875,
  lon: 12.375,
  countryCode: 'IT',
};

const reading = (): ParasiteRiskCellReading => ({
  cell: {lat: -27.375, lon: 153.125},
  countryCode: 'AU',
  region: 'AU',
  modelVersion: '2026.07-1',
  computedAt: '2026-07-29T00:00:00.000Z',
  overallTier: 'HIGH',
  degraded: false,
  readings: [
    {
      parasiteId: 'paralysis_tick',
      group: 'TICK',
      index: 62,
      tier: 'HIGH',
      trend: 'RISING',
    },
  ],
});

const subscription = (id: string, label: string) => ({
  id,
  label,
  lat: -27.375,
  lon: 153.125,
  countryCode: 'AU',
  alertTier: 'HIGH' as const,
  createdAt: '2026-07-29T00:00:00.000Z',
});

describe('parasiteRiskSlice', () => {
  it('starts empty', () => {
    expect(parasiteRiskReducer(undefined, {type: 'init'})).toEqual(
      parasiteRiskInitialState,
    );
  });

  it('stores the reading and location on success', () => {
    const state = parasiteRiskReducer(
      parasiteRiskInitialState,
      loadRiskForLocation.fulfilled(
        {location: brisbane, reading: reading()},
        'id',
        brisbane,
      ),
    );

    expect(state.loading).toBe(false);
    expect(state.location).toEqual(brisbane);
    expect(state.reading?.overallTier).toBe('HIGH');
  });

  it('records recent locations most recent first', () => {
    let state = parasiteRiskReducer(
      parasiteRiskInitialState,
      loadRiskForLocation.fulfilled(
        {location: brisbane, reading: reading()},
        'id',
        brisbane,
      ),
    );
    state = parasiteRiskReducer(
      state,
      loadRiskForLocation.fulfilled(
        {location: rome, reading: reading()},
        'id',
        rome,
      ),
    );

    expect(state.recentLocations.map(l => l.label)).toEqual([
      'Rome',
      'Brisbane',
    ]);
  });

  it('does not duplicate a location that is looked up twice', () => {
    let state = parasiteRiskInitialState;
    for (let i = 0; i < 3; i += 1) {
      state = parasiteRiskReducer(
        state,
        loadRiskForLocation.fulfilled(
          {location: brisbane, reading: reading()},
          'id',
          brisbane,
        ),
      );
    }

    expect(state.recentLocations).toHaveLength(1);
  });

  it('caps recent locations at five', () => {
    let state = parasiteRiskInitialState;

    for (let i = 0; i < 8; i += 1) {
      const location = {...brisbane, label: `Place ${i}`};
      state = parasiteRiskReducer(
        state,
        loadRiskForLocation.fulfilled(
          {location, reading: reading()},
          'id',
          location,
        ),
      );
    }

    expect(state.recentLocations).toHaveLength(5);
    expect(state.recentLocations[0].label).toBe('Place 7');
  });

  it('surfaces the rejection message', () => {
    const action = {
      type: loadRiskForLocation.rejected.type,
      payload: 'No forecast here',
    };
    const state = parasiteRiskReducer(parasiteRiskInitialState, action);

    expect(state.loading).toBe(false);
    expect(state.error).toBe('No forecast here');
  });

  it('keeps the previous reading visible when a refresh fails', () => {
    const loaded = parasiteRiskReducer(
      parasiteRiskInitialState,
      loadRiskForLocation.fulfilled(
        {location: brisbane, reading: reading()},
        'id',
        brisbane,
      ),
    );
    const failed = parasiteRiskReducer(loaded, {
      type: loadRiskForLocation.rejected.type,
      payload: 'offline',
    });

    expect(failed.reading).not.toBeNull();
  });

  it('replaces the subscription list on load', () => {
    const state = parasiteRiskReducer(
      parasiteRiskInitialState,
      loadSubscriptions.fulfilled([subscription('s1', 'Brisbane')], 'id'),
    );

    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptionsLoading).toBe(false);
  });

  it('replaces rather than duplicates an existing subscription on follow', () => {
    let state = parasiteRiskReducer(
      parasiteRiskInitialState,
      loadSubscriptions.fulfilled([subscription('s1', 'Brisbane')], 'id'),
    );
    state = parasiteRiskReducer(
      state,
      followLocation.fulfilled(subscription('s1', 'Brisbane North'), 'id', {
        location: brisbane,
      }),
    );

    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0].label).toBe('Brisbane North');
  });

  it('removes a subscription on unfollow', () => {
    let state = parasiteRiskReducer(
      parasiteRiskInitialState,
      loadSubscriptions.fulfilled(
        [subscription('s1', 'Brisbane'), subscription('s2', 'Rome')],
        'id',
      ),
    );
    state = parasiteRiskReducer(
      state,
      unfollowLocation.fulfilled('s1', 'id', 's1'),
    );

    expect(state.subscriptions.map(s => s.id)).toEqual(['s2']);
  });

  it('marks loading and clears a stale error when a lookup starts', () => {
    const state = parasiteRiskReducer(
      {...parasiteRiskInitialState, error: 'previous failure'},
      {type: loadRiskForLocation.pending.type},
    );

    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('marks subscriptions loading while they are fetched', () => {
    const state = parasiteRiskReducer(parasiteRiskInitialState, {
      type: loadSubscriptions.pending.type,
    });

    expect(state.subscriptionsLoading).toBe(true);
  });

  it('records a subscription load failure', () => {
    const state = parasiteRiskReducer(parasiteRiskInitialState, {
      type: loadSubscriptions.rejected.type,
      payload: 'no network',
    });

    expect(state.subscriptionsLoading).toBe(false);
    expect(state.error).toBe('no network');
  });

  it('records a follow failure', () => {
    const state = parasiteRiskReducer(parasiteRiskInitialState, {
      type: followLocation.rejected.type,
      payload: 'too many locations',
    });

    expect(state.error).toBe('too many locations');
  });

  it('records an unfollow failure', () => {
    const state = parasiteRiskReducer(parasiteRiskInitialState, {
      type: unfollowLocation.rejected.type,
      payload: 'not found',
    });

    expect(state.error).toBe('not found');
  });

  it.each([
    ['lookup', loadRiskForLocation.rejected.type],
    ['subscription load', loadSubscriptions.rejected.type],
    ['follow', followLocation.rejected.type],
    ['unfollow', unfollowLocation.rejected.type],
  ])(
    'falls back to a generic message when %s rejects with no payload',
    (_, type) => {
      const state = parasiteRiskReducer(parasiteRiskInitialState, {type});
      expect(state.error).toBe('Something went wrong.');
    },
  );

  it('records the disclaimer acknowledgement so it is shown once', () => {
    const state = parasiteRiskReducer(
      parasiteRiskInitialState,
      acknowledgeDisclaimer(),
    );
    expect(state.disclaimerAcknowledged).toBe(true);
  });

  it('clears the error without touching the reading', () => {
    const withError = {...parasiteRiskInitialState, error: 'boom'};
    const state = parasiteRiskReducer(withError, clearParasiteRiskError());
    expect(state.error).toBeNull();
  });

  it('resets everything on sign-out', () => {
    const dirty = {
      ...parasiteRiskInitialState,
      location: brisbane,
      error: 'boom',
    };
    expect(parasiteRiskReducer(dirty, resetParasiteRiskState())).toEqual(
      parasiteRiskInitialState,
    );
  });
});
