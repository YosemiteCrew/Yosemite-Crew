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
import {snapToRiskCell} from '@yosemite-crew/types';

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

// Two real places that share a name but sit in different forecast cells.
const springfieldIl: RiskLocation = {
  label: 'Springfield',
  lat: 39.8,
  lon: -89.65,
  countryCode: 'US',
};

const springfieldMa: RiskLocation = {
  label: 'Springfield',
  lat: 42.1,
  lon: -72.59,
  countryCode: 'US',
};

const reading = (
  overrides: Partial<ParasiteRiskCellReading> = {},
): ParasiteRiskCellReading => ({
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
  ...overrides,
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

  it('stores only coarse cell coordinates for a precise device location', () => {
    const preciseLocation = {
      ...brisbane,
      lat: -27.4697707,
      lon: 153.025131,
    };
    const state = parasiteRiskReducer(
      parasiteRiskInitialState,
      loadRiskForLocation.fulfilled(
        {location: preciseLocation, reading: reading()},
        'id',
        preciseLocation,
      ),
    );
    const snapped = snapToRiskCell(preciseLocation.lat, preciseLocation.lon);

    expect(state.location).toEqual({...preciseLocation, ...snapped});
    expect(state.recentLocations[0]).toEqual({...preciseLocation, ...snapped});
    expect(state.location?.lat).not.toBe(preciseLocation.lat);
    expect(state.location?.lon).not.toBe(preciseLocation.lon);
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

  it('keeps two same-named places that sit in different cells', () => {
    let state = parasiteRiskReducer(
      parasiteRiskInitialState,
      loadRiskForLocation.fulfilled(
        {location: springfieldIl, reading: reading()},
        'id',
        springfieldIl,
      ),
    );
    state = parasiteRiskReducer(
      state,
      loadRiskForLocation.fulfilled(
        {location: springfieldMa, reading: reading()},
        'id',
        springfieldMa,
      ),
    );

    expect(state.recentLocations).toHaveLength(2);
    expect(state.recentLocations.map(entry => entry.lat)).toEqual([
      snapToRiskCell(springfieldMa.lat, springfieldMa.lon).lat,
      snapToRiskCell(springfieldIl.lat, springfieldIl.lon).lat,
    ]);
  });

  it('collapses two coordinates from the same cell into one recent entry', () => {
    const nearby = {
      ...brisbane,
      label: 'Brisbane CBD',
      lat: brisbane.lat + 0.01,
      lon: brisbane.lon + 0.01,
    };
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
        {location: nearby, reading: reading()},
        'id',
        nearby,
      ),
    );

    expect(state.recentLocations).toHaveLength(1);
    expect(state.recentLocations[0].label).toBe('Brisbane CBD');
  });

  it('caps recent locations at five', () => {
    let state = parasiteRiskInitialState;

    for (let i = 0; i < 8; i += 1) {
      // Half a degree apart so each place lands in its own forecast cell.
      const location = {
        ...brisbane,
        label: `Place ${i}`,
        lat: brisbane.lat + i * 0.5,
      };
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
      loadRiskForLocation.pending('req-1', brisbane),
    );

    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  describe('overlapping lookups', () => {
    /** Brisbane is asked for first, then Rome while Brisbane is still open. */
    const twoInFlight = () => {
      const first = parasiteRiskReducer(
        parasiteRiskInitialState,
        loadRiskForLocation.pending('req-brisbane', brisbane),
      );
      return parasiteRiskReducer(
        first,
        loadRiskForLocation.pending('req-rome', rome),
      );
    };

    it('keeps the newest location when an older response lands last', () => {
      let state = parasiteRiskReducer(
        twoInFlight(),
        loadRiskForLocation.fulfilled(
          {location: rome, reading: reading({countryCode: 'IT'})},
          'req-rome',
          rome,
        ),
      );
      state = parasiteRiskReducer(
        state,
        loadRiskForLocation.fulfilled(
          {location: brisbane, reading: reading()},
          'req-brisbane',
          brisbane,
        ),
      );

      expect(state.location).toEqual(rome);
      expect(state.reading?.countryCode).toBe('IT');
      expect(state.recentLocations.map(entry => entry.label)).toEqual(['Rome']);
      expect(state.loading).toBe(false);
    });

    it('leaves the newest lookup running when the superseded one fails', () => {
      const state = parasiteRiskReducer(
        twoInFlight(),
        loadRiskForLocation.rejected(null, 'req-brisbane', brisbane, 'offline'),
      );

      expect(state.error).toBeNull();
      expect(state.loading).toBe(true);
    });

    it('still reports a failure of the newest lookup', () => {
      const state = parasiteRiskReducer(
        twoInFlight(),
        loadRiskForLocation.rejected(null, 'req-rome', rome, 'offline'),
      );

      expect(state.error).toBe('offline');
      expect(state.loading).toBe(false);
    });
  });

  it('marks subscriptions loading while they are fetched', () => {
    const state = parasiteRiskReducer(parasiteRiskInitialState, {
      type: loadSubscriptions.pending.type,
    });

    expect(state.subscriptionsLoading).toBe(true);
  });

  it.each([followLocation.pending.type, unfollowLocation.pending.type])(
    'marks subscriptions loading during %s',
    type => {
      const state = parasiteRiskReducer(parasiteRiskInitialState, {type});
      expect(state.subscriptionsLoading).toBe(true);
    },
  );

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
      expect(state.error).toBe('parasiteRisk.errors.forecast');
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
