import {
  DEFAULT_COLLECTION_LOAD_ERROR,
  markCollectionFailed,
  markCollectionHydrated,
  markCollectionPending,
  selectCollectionFailure,
  selectCollectionHydrated,
  selectCollectionLoadedAt,
  type CollectionLoadState,
} from '@/shared/store/collectionLoadState';

const emptyState = (): CollectionLoadState => ({
  hydratedCompanions: {},
  failedCompanions: {},
  activeRequests: {},
  lastLoadedAt: {},
});

describe('collectionLoadState', () => {
  describe('markCollectionFailed', () => {
    it('records the failure without marking the collection hydrated', () => {
      const state = emptyState();

      markCollectionFailed(state, 'c1', 'network down');

      expect(state.failedCompanions.c1).toBe('network down');
      // The whole point: a failed fetch must not look like a loaded, empty one.
      expect(state.hydratedCompanions.c1).toBeUndefined();
    });

    it('falls back to a canonical message when none is supplied', () => {
      const state = emptyState();

      markCollectionFailed(state, 'c1');
      expect(state.failedCompanions.c1).toBe(DEFAULT_COLLECTION_LOAD_ERROR);

      markCollectionFailed(state, 'c2', null);
      expect(state.failedCompanions.c2).toBe(DEFAULT_COLLECTION_LOAD_ERROR);

      markCollectionFailed(state, 'c3', '');
      expect(state.failedCompanions.c3).toBe(DEFAULT_COLLECTION_LOAD_ERROR);
    });

    it('ignores a missing companion id', () => {
      const state = emptyState();

      markCollectionFailed(state, null, 'boom');
      markCollectionFailed(state, undefined, 'boom');
      markCollectionFailed(state, '', 'boom');

      expect(state.failedCompanions).toEqual({});
    });
  });

  describe('markCollectionHydrated', () => {
    it('marks hydrated and clears any recorded failure', () => {
      const state = emptyState();
      markCollectionFailed(state, 'c1', 'network down');

      markCollectionHydrated(state, 'c1');

      expect(state.hydratedCompanions.c1).toBe(true);
      expect(state.failedCompanions.c1).toBeUndefined();
    });

    it('leaves other companions alone', () => {
      const state = emptyState();
      markCollectionFailed(state, 'c1', 'boom');

      markCollectionHydrated(state, 'c2');

      expect(state.failedCompanions.c1).toBe('boom');
    });

    it('ignores a missing companion id', () => {
      const state = emptyState();
      markCollectionHydrated(state, null);
      expect(state.hydratedCompanions).toEqual({});
    });
  });

  describe('markCollectionPending', () => {
    it('clears the previous failure so a retry is not shown its own error', () => {
      const state = emptyState();
      markCollectionFailed(state, 'c1', 'network down');

      markCollectionPending(state, 'c1');

      expect(state.failedCompanions.c1).toBeUndefined();
    });

    it('does not un-hydrate an already loaded collection', () => {
      const state = emptyState();
      markCollectionHydrated(state, 'c1');

      markCollectionPending(state, 'c1');

      expect(state.hydratedCompanions.c1).toBe(true);
    });

    it('ignores a missing companion id', () => {
      const state = emptyState();
      markCollectionPending(state, undefined);
      expect(state.failedCompanions).toEqual({});
    });
  });

  // Every slice using these helpers is persisted. State written by a build that
  // predates `failedCompanions` rehydrates without it, and writing through the
  // missing map would throw on the first fetch after an upgrade.
  describe('rehydration from an older persisted shape', () => {
    it('does not throw when failedCompanions is missing', () => {
      const legacy = {hydratedCompanions: {c1: true}} as CollectionLoadState;

      expect(() => markCollectionFailed(legacy, 'c1', 'boom')).not.toThrow();
      expect(legacy.failedCompanions.c1).toBe('boom');
    });

    it('does not throw when hydratedCompanions is missing', () => {
      const legacy = {} as CollectionLoadState;

      expect(() => markCollectionHydrated(legacy, 'c1')).not.toThrow();
      expect(legacy.hydratedCompanions.c1).toBe(true);
    });

    it('does not throw on pending with neither map present', () => {
      const legacy = {} as CollectionLoadState;

      expect(() => markCollectionPending(legacy, 'c1')).not.toThrow();
      expect(legacy.failedCompanions).toEqual({});
    });
  });

  // Companion ids arrive as a thunk argument and are used as an object key, so
  // `__proto__` would reach Object.prototype instead of the map.
  describe('prototype-pollution safety', () => {
    afterEach(() => {
      // Prove nothing leaked onto the prototype regardless of outcome.
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it.each(['__proto__', 'constructor', 'prototype'])(
      'refuses %p as a companion id when recording a failure',
      unsafe => {
        const state = emptyState();

        markCollectionFailed(state, unsafe, 'polluted');

        // `state.failedCompanions['__proto__']` returns Object.prototype, not
        // undefined, so the meaningful assertion is that no OWN key was added.
        expect(
          Object.prototype.hasOwnProperty.call(state.failedCompanions, unsafe),
        ).toBe(false);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      },
    );

    it.each(['__proto__', 'constructor', 'prototype'])(
      'refuses %p as a companion id when marking hydrated',
      unsafe => {
        const state = emptyState();

        markCollectionHydrated(state, unsafe);

        expect(
          Object.prototype.hasOwnProperty.call(
            state.hydratedCompanions,
            unsafe,
          ),
        ).toBe(false);
      },
    );

    it('refuses an unsafe id on pending without touching the maps', () => {
      const state = emptyState();
      markCollectionFailed(state, 'c1', 'boom');

      markCollectionPending(state, '__proto__');

      expect(state.failedCompanions.c1).toBe('boom');
    });

    it('never reports an inherited property as a real value', () => {
      const state = emptyState();

      expect(selectCollectionFailure(state, '__proto__')).toBeUndefined();
      expect(selectCollectionFailure(state, 'toString')).toBeUndefined();
      expect(selectCollectionHydrated(state, '__proto__')).toBe(false);
      expect(selectCollectionHydrated(state, 'toString')).toBe(false);
    });
  });

  // Several screens dispatch the same fetch twice on a focused mount. Without
  // request-id tracking, an older request rejecting after a newer one returned
  // an empty list recorded a failure over a successful hydration, and the
  // screen replaced a correct empty state with an error.
  describe('stale rejections', () => {
    it('ignores a rejection from a request that a later success superseded', () => {
      const state = emptyState();

      markCollectionPending(state, 'c1', 'req-1');
      markCollectionPending(state, 'c1', 'req-2');
      markCollectionHydrated(state, 'c1');
      markCollectionFailed(state, 'c1', 'stale boom', 'req-1');

      expect(state.hydratedCompanions.c1).toBe(true);
      expect(state.failedCompanions.c1).toBeUndefined();
    });

    it('ignores a rejection superseded by a newer in-flight request', () => {
      const state = emptyState();

      markCollectionPending(state, 'c1', 'req-1');
      markCollectionPending(state, 'c1', 'req-2');
      markCollectionFailed(state, 'c1', 'stale boom', 'req-1');

      expect(state.failedCompanions.c1).toBeUndefined();
    });

    it('records a rejection from the newest request', () => {
      const state = emptyState();

      markCollectionPending(state, 'c1', 'req-1');
      markCollectionFailed(state, 'c1', 'real boom', 'req-1');

      expect(state.failedCompanions.c1).toBe('real boom');
    });

    it('records only the first of two rejections, newest request first', () => {
      const state = emptyState();

      markCollectionPending(state, 'c1', 'req-1');
      markCollectionPending(state, 'c1', 'req-2');
      markCollectionFailed(state, 'c1', 'newer boom', 'req-2');
      markCollectionFailed(state, 'c1', 'older boom', 'req-1');

      expect(state.failedCompanions.c1).toBe('newer boom');
    });

    it('still records a failure when no request id is supplied', () => {
      const state = emptyState();

      markCollectionFailed(state, 'c1', 'boom');

      expect(state.failedCompanions.c1).toBe('boom');
    });

    it('tolerates rehydrated state with no activeRequests map', () => {
      const legacy = {
        hydratedCompanions: {},
        failedCompanions: {},
      } as CollectionLoadState;

      expect(() => markCollectionPending(legacy, 'c1', 'req-1')).not.toThrow();
      expect(legacy.activeRequests.c1).toBe('req-1');
    });
  });

  // A stale list has to be able to say how old it is: minutes matters
  // differently from days when the content is a medication schedule.
  describe('last successful fetch', () => {
    it('records the timestamp on a successful fetch', () => {
      const state = emptyState();

      markCollectionHydrated(state, 'c1', 1_700_000_000_000);

      expect(selectCollectionLoadedAt(state, 'c1')).toBe(1_700_000_000_000);
    });

    it('keeps the timestamp when a later refresh fails', () => {
      const state = emptyState();
      markCollectionHydrated(state, 'c1', 1_700_000_000_000);

      markCollectionFailed(state, 'c1', 'network down');

      // The pair a stale banner needs: a failure AND how old the content is.
      expect(selectCollectionFailure(state, 'c1')).toBe('network down');
      expect(selectCollectionLoadedAt(state, 'c1')).toBe(1_700_000_000_000);
    });

    it('advances the timestamp when a retry succeeds', () => {
      const state = emptyState();
      markCollectionHydrated(state, 'c1', 1_700_000_000_000);
      markCollectionFailed(state, 'c1', 'network down');

      markCollectionHydrated(state, 'c1', 1_700_000_060_000);

      expect(selectCollectionLoadedAt(state, 'c1')).toBe(1_700_000_060_000);
      expect(selectCollectionFailure(state, 'c1')).toBeUndefined();
    });

    it('reports undefined before any successful fetch', () => {
      const state = emptyState();
      markCollectionFailed(state, 'c1', 'network down');

      expect(selectCollectionLoadedAt(state, 'c1')).toBeUndefined();
    });

    it('tolerates an absent slice, key or map', () => {
      expect(selectCollectionLoadedAt(undefined, 'c1')).toBeUndefined();
      expect(selectCollectionLoadedAt({}, 'c1')).toBeUndefined();
      expect(selectCollectionLoadedAt(emptyState(), null)).toBeUndefined();
      expect(
        selectCollectionLoadedAt(emptyState(), '__proto__'),
      ).toBeUndefined();
    });

    it('does not throw on state rehydrated without the map', () => {
      const legacy = {
        hydratedCompanions: {},
        failedCompanions: {},
        activeRequests: {},
      } as CollectionLoadState;

      expect(() =>
        markCollectionHydrated(legacy, 'c1', 1_700_000_000_000),
      ).not.toThrow();
      expect(legacy.lastLoadedAt.c1).toBe(1_700_000_000_000);
    });
  });

  describe('selectors', () => {
    it('reads the failure message back', () => {
      const state = emptyState();
      markCollectionFailed(state, 'c1', 'network down');

      expect(selectCollectionFailure(state, 'c1')).toBe('network down');
      expect(selectCollectionFailure(state, 'c2')).toBeUndefined();
    });

    it('reads the hydrated flag back', () => {
      const state = emptyState();
      markCollectionHydrated(state, 'c1');

      expect(selectCollectionHydrated(state, 'c1')).toBe(true);
      expect(selectCollectionHydrated(state, 'c2')).toBe(false);
    });

    it('tolerates an absent slice or companion id', () => {
      expect(selectCollectionFailure(undefined, 'c1')).toBeUndefined();
      expect(selectCollectionFailure({}, 'c1')).toBeUndefined();
      expect(selectCollectionFailure(emptyState(), null)).toBeUndefined();

      expect(selectCollectionHydrated(undefined, 'c1')).toBe(false);
      expect(selectCollectionHydrated({}, 'c1')).toBe(false);
      expect(selectCollectionHydrated(emptyState(), null)).toBe(false);
    });
  });
});
