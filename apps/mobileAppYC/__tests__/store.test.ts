const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const capturedConfig: {persistConfig: any} = {persistConfig: null};

jest.mock('redux-persist', () => {
  const actual = jest.requireActual('redux-persist');

  return {
    ...actual,
    persistReducer: jest.fn((config, reducer) => {
      capturedConfig.persistConfig = config;
      return actual.persistReducer(config, reducer);
    }),
    persistStore: jest.fn(() => ({
      purge: jest.fn(),
      flush: jest.fn(),
      pause: jest.fn(),
      persist: jest.fn(),
      dispatch: jest.fn(),
      getState: jest.fn(),
      subscribe: jest.fn(),
    })),
  };
});

const capturedToolkit: {middlewareBuilder: any} = {middlewareBuilder: null};

jest.mock('@reduxjs/toolkit', () => {
  const actual = jest.requireActual('@reduxjs/toolkit');

  return {
    ...actual,
    configureStore: jest.fn(options => {
      capturedToolkit.middlewareBuilder = options.middleware;
      return actual.configureStore(options);
    }),
  };
});

import {store, persistor} from '../src/app/store';

describe('Redux Store', () => {
  afterEach(() => {
    consoleSpy.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('initializes the store with persisted reducer', () => {
    expect(store).toBeDefined();
    expect(persistor).toBeDefined();

    const state = store.getState();

    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('theme');
    expect(state).toHaveProperty('companion');
  });

  it('initializes all root reducer slices', () => {
    const state = store.getState();

    expect(state).toEqual(
      expect.objectContaining({
        auth: expect.anything(),
        theme: expect.anything(),
        companion: expect.anything(),
        documents: expect.anything(),
        expenses: expect.anything(),
        tasks: expect.anything(),
        appointments: expect.anything(),
        businesses: expect.anything(),
        coParent: expect.anything(),
        linkedBusinesses: expect.anything(),
        notifications: expect.anything(),
        forms: expect.anything(),
        preferences: expect.anything(),
      }),
    );
  });

  it('configures redux-persist correctly', () => {
    const config = capturedConfig.persistConfig;

    expect(config).toBeDefined();
    expect(config.key).toBe('root');
    expect(config.version).toBe(9);
    expect(config.storage).toBeDefined();
    expect(config.migrate).toEqual(expect.any(Function));
  });

  it('whitelists all persisted slices', () => {
    expect(capturedConfig.persistConfig.whitelist).toEqual([
      'auth',
      'theme',
      'documents',
      'companion',
      'expenses',
      'tasks',
      'appointments',
      'businesses',
      'coParent',
      'linkedBusinesses',
      'notifications',
      'forms',
      'preferences',
    ]);
  });

  it('configures middleware ignored redux-persist actions', () => {
    expect(capturedToolkit.middlewareBuilder).toBeDefined();

    const getDefaultMiddleware = jest.fn(config => config);
    const result = capturedToolkit.middlewareBuilder(getDefaultMiddleware);

    expect(getDefaultMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({
        serializableCheck: expect.objectContaining({
          ignoredActions: expect.arrayContaining([
            'persist/FLUSH',
            'persist/REHYDRATE',
            'persist/PAUSE',
            'persist/PERSIST',
            'persist/PURGE',
            'persist/REGISTER',
          ]),
        }),
        immutableCheck: {
          warnAfter: 128,
        },
      }),
    );

    expect(result).toBeDefined();
  });

  describe('In-Memory Mock Storage', () => {
    let mockStorage: any;

    beforeAll(() => {
      mockStorage = capturedConfig.persistConfig.storage;
    });

    it('implements setItem and getItem', async () => {
      await mockStorage.setItem('testKey', 'testValue');

      const value = await mockStorage.getItem('testKey');

      expect(value).toBe('testValue');
    });

    it('returns null for non-existent items', async () => {
      const value = await mockStorage.getItem('missingKey');

      expect(value).toBeNull();
    });

    it('implements removeItem', async () => {
      await mockStorage.setItem('removeMe', 'data');
      await mockStorage.removeItem('removeMe');

      const value = await mockStorage.getItem('removeMe');

      expect(value).toBeNull();
    });

    it('implements getAllKeys', async () => {
      await mockStorage.setItem('key1', 'v1');

      const keys = await mockStorage.getAllKeys();

      expect(keys).toContain('key1');
    });

    it('implements multiSet and multiGet', async () => {
      await mockStorage.multiSet([
        ['mk1', 'mv1'],
        ['mk2', 'mv2'],
      ]);

      const values = await mockStorage.multiGet(['mk1', 'mk2', 'missing']);

      expect(values).toEqual([
        ['mk1', 'mv1'],
        ['mk2', 'mv2'],
        ['missing', null],
      ]);
    });

    it('implements multiRemove', async () => {
      await mockStorage.setItem('mr1', 'v');
      await mockStorage.multiRemove(['mr1']);

      const val = await mockStorage.getItem('mr1');

      expect(val).toBeNull();
    });
  });

  describe('Migrations', () => {
    const runMigrate = async (version: number | undefined, state: any) => {
      const migrate = capturedConfig.persistConfig.migrate;
      const persistedState = {
        _persist: {version},
        ...state,
      };

      return await migrate(persistedState);
    };

    it('handles undefined state gracefully', async () => {
      const migrate = capturedConfig.persistConfig.migrate;

      const result = await migrate(undefined);

      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Redux Persist] Migrating state from version',
        undefined,
      );
    });

    it('handles v1 -> v2 migration', async () => {
      const result = await runMigrate(1, {});

      expect(result).toEqual(
        expect.objectContaining({
          _persist: {version: 1},
        }),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v1 to v2'),
      );
    });

    it('handles v2 -> v3 migration and resets businesses', async () => {
      const oldState = {
        businesses: {
          someOldData: true,
        },
      };

      const newState = await runMigrate(2, oldState);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v2 to v3'),
      );
      // The runner applies EVERY step from the persisted version upward, so a
      // v2 state also picks up `services` from the v4 -> v5 step. Before the
      // chain was fixed it stopped after v2 -> v3 and this user stayed on a
      // shape three versions stale.
      expect(newState.businesses).toEqual({
        businesses: [],
        employees: [],
        availability: [],
        loading: false,
        error: null,
        services: [],
      });
    });

    it('handles v2 -> v3 migration when businesses slice is missing', async () => {
      const newState = await runMigrate(2, {});

      expect(newState.businesses).toBeUndefined();
    });

    it('handles v3 -> v4 migration and initializes notifications', async () => {
      const newState = await runMigrate(3, {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v3 to v4'),
      );
      expect(newState.notifications).toEqual({
        items: [],
        loading: false,
        error: null,
        unreadCount: 0,
        hydratedCompanions: {},
        // Added by the v7 -> v8 step, which the chained runner also applies.
        failedCompanions: {},
        activeRequests: {},
        lastLoadedAt: {},
        filter: 'all',
        sortBy: 'new',
      });
    });

    it('handles v3 -> v4 migration and keeps existing notifications', async () => {
      const oldState = {
        notifications: {
          existing: true,
        },
      };

      const newState = await runMigrate(3, oldState);

      expect(newState.notifications).toEqual({
        existing: true,
        hydratedCompanions: {},
        failedCompanions: {},
        activeRequests: {},
        lastLoadedAt: {},
      });
    });

    it('handles v4 -> v5 migration and initializes services', async () => {
      const oldState = {
        businesses: {
          businesses: [],
        },
      };

      const newState = await runMigrate(4, oldState);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v4 to v5'),
      );
      expect(newState.businesses.services).toEqual([]);
    });

    it('handles v4 -> v5 migration and keeps existing services', async () => {
      const oldState = {
        businesses: {
          services: ['exists'],
        },
      };

      const newState = await runMigrate(4, oldState);

      expect(newState.businesses.services).toEqual(['exists']);
    });

    it('handles v4 -> v5 migration when businesses slice is missing', async () => {
      const newState = await runMigrate(4, {});

      expect(newState.businesses).toBeUndefined();
    });

    it('handles v5 -> v6 migration by resetting invalid companion.companions', async () => {
      const oldState = {
        companion: {
          companions: {
            invalid: true,
          },
        },
      };

      const newState = await runMigrate(5, oldState);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v5 to v6'),
      );
      expect(newState.companion.companions).toEqual([]);
    });

    it('handles v5 -> v6 migration and keeps valid companion.companions array', async () => {
      const oldState = {
        companion: {
          companions: [{id: '1'}],
        },
      };

      const newState = await runMigrate(5, oldState);

      expect(newState.companion.companions).toEqual([{id: '1'}]);
    });

    it('handles v5 -> v6 migration when companion slice is missing', async () => {
      const newState = await runMigrate(5, {});

      expect(newState.companion).toBeUndefined();
    });

    it('handles v6 -> v7 migration and initializes preferences', async () => {
      const newState = await runMigrate(6, {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v6 to v7'),
      );
      expect(newState.preferences).toEqual({
        weightOverride: null,
        distanceOverride: null,
        currencyOverride: null,
      });
    });

    it('handles v6 -> v7 migration and keeps existing preferences', async () => {
      const oldState = {
        preferences: {
          weightOverride: 'lbs',
          distanceOverride: 'mi',
          currencyOverride: 'USD',
        },
      };

      const newState = await runMigrate(6, oldState);

      expect(newState.preferences).toEqual({
        weightOverride: 'lbs',
        distanceOverride: 'mi',
        currencyOverride: 'USD',
      });
    });

    // The list slices below are all in the persist whitelist, so a user
    // upgrading from v7 rehydrates without `failedCompanions` and the first
    // fetch after launch would write through undefined.
    it('handles v7 -> v8 migration and adds list load-failure state', async () => {
      const oldState = {
        tasks: {items: [], hydratedCompanions: {c1: true}},
        appointments: {items: []},
        expenses: {items: []},
        notifications: {items: []},
        companion: {companions: []},
      };

      const newState = await runMigrate(7, oldState);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v7 to v8'),
      );
      expect(newState.tasks.failedCompanions).toEqual({});
      expect(newState.tasks.hydratedCompanions).toEqual({c1: true});
      expect(newState.appointments.failedCompanions).toEqual({});
      expect(newState.expenses.failedCompanions).toEqual({});
      expect(newState.notifications.failedCompanions).toEqual({});
      expect(newState.companion.hasLoaded).toBe(false);
      expect(newState.companion.loadError).toBeNull();
    });

    it('leaves existing v8 load-failure state untouched', async () => {
      const oldState = {
        tasks: {failedCompanions: {c1: 'boom'}, hydratedCompanions: {}},
        companion: {hasLoaded: true, loadError: 'boom'},
      };

      const newState = await runMigrate(7, oldState);

      expect(newState.tasks.failedCompanions).toEqual({c1: 'boom'});
      expect(newState.companion.hasLoaded).toBe(true);
      expect(newState.companion.loadError).toBe('boom');
    });

    it('skips slices that are absent from the persisted state', async () => {
      const newState = await runMigrate(7, {});

      expect(newState.tasks).toBeUndefined();
      expect(newState.companion).toBeUndefined();
    });

    // The runner used to apply exactly one step, so a user more than one
    // version behind silently skipped every later migration. That made each new
    // migration reach fewer users the later it was added.
    it('applies every migration step from the persisted version upward', async () => {
      const newState = await runMigrate(1, {
        businesses: {someOldData: true},
        tasks: {items: []},
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v1 to v2'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v7 to v8'),
      );
      // v2 -> v3 reset it, v4 -> v5 added services, v7 -> v8 added the maps.
      expect(newState.businesses.services).toEqual([]);
      expect(newState.notifications).toBeDefined();
      expect(newState.preferences).toBeDefined();
      expect(newState.tasks.failedCompanions).toEqual({});
    });

    it('handles v8 -> v9 migration and adds staleness tracking', async () => {
      const oldState = {
        tasks: {
          items: [],
          hydratedCompanions: {c1: true},
          failedCompanions: {},
        },
        appointments: {items: []},
        expenses: {items: []},
        notifications: {items: []},
      };

      const newState = await runMigrate(8, oldState);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v8 to v9'),
      );
      expect(newState.tasks.activeRequests).toEqual({});
      expect(newState.tasks.lastLoadedAt).toEqual({});
      expect(newState.tasks.hydratedCompanions).toEqual({c1: true});
      expect(newState.appointments.lastLoadedAt).toEqual({});
      expect(newState.expenses.lastLoadedAt).toEqual({});
      expect(newState.notifications.lastLoadedAt).toEqual({});
    });

    it('leaves existing v9 staleness state untouched', async () => {
      const oldState = {
        tasks: {activeRequests: {c1: 'r1'}, lastLoadedAt: {c1: 123}},
      };

      const newState = await runMigrate(8, oldState);

      expect(newState.tasks.activeRequests).toEqual({c1: 'r1'});
      expect(newState.tasks.lastLoadedAt).toEqual({c1: 123});
    });

    it('handles non-matching versions gracefully', async () => {
      const state = {
        foo: 'bar',
      };

      const result = await runMigrate(99, state);

      expect(result).toEqual(
        expect.objectContaining({
          foo: 'bar',
        }),
      );
    });

    it('handles missing persisted version gracefully', async () => {
      const result = await runMigrate(undefined, {
        foo: 'bar',
      });

      expect(result).toEqual(
        expect.objectContaining({
          foo: 'bar',
        }),
      );
    });
  });
});
