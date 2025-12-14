const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));


const capturedConfig: { persistConfig: any } = { persistConfig: null };

jest.mock('redux-persist', () => {
  const actual = jest.requireActual('redux-persist');
  return {
    ...actual,
    persistReducer: jest.fn((config, reducer) => {
      capturedConfig.persistConfig = config; // CAPTURE THE HIDDEN CONFIG
      return actual.persistReducer(config, reducer);
    }),
    persistStore: jest.fn(() => ({
        purge: jest.fn(),
        flush: jest.fn(),
        dispatch: jest.fn(),
        getState: jest.fn(),
        subscribe: jest.fn(),
    })),
  };
});

// Mock Redux Toolkit to capture the middleware configuration function
const capturedToolkit: { middlewareBuilder: any } = { middlewareBuilder: null };

jest.mock('@reduxjs/toolkit', () => {
  const actual = jest.requireActual('@reduxjs/toolkit');
  return {
    ...actual,
    configureStore: jest.fn((options) => {
      capturedToolkit.middlewareBuilder = options.middleware; // CAPTURE MIDDLEWARE SETUP
      return actual.configureStore(options);
    }),
  };
});

// --- 2. Import the Store (Triggers execution) ---
// Note: We use relative path ../src/app/store assuming test is in __tests__ at root
import {store, persistor} from '../src/app/store';

describe('Redux Store', () => {

  afterEach(() => {
    consoleSpy.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // 1. Core Initialization
  // ===========================================================================
  it('initializes the store with persisted reducer', () => {
    expect(store).toBeDefined();
    expect(persistor).toBeDefined();
    const state = store.getState();
    // Verify root reducer structure via state
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('theme');
    expect(state).toHaveProperty('companion');
  });

  // ===========================================================================
  // 2. Persistence Configuration (Using Captured Config)
  // ===========================================================================
  it('configures redux-persist correctly', () => {
    const config = capturedConfig.persistConfig;
    expect(config).toBeDefined();
    expect(config.key).toBe('root');
    expect(config.version).toBe(5);
    expect(config.whitelist).toContain('auth');
    expect(config.whitelist).toContain('notifications');
  });

  // ===========================================================================
  // 3. In-Memory Storage Logic (Jest Environment Branch)
  // ===========================================================================
  // This section covers the lines `if (isJest) { ... }` in the source file
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
      // Clear previous state implicitly by ignoring or overwriting,
      // but strictly getAllKeys returns keys in the closure store.
      // Since the store closure is shared across tests in this run, we might see keys from above.
      await mockStorage.setItem('key1', 'v1');
      const keys = await mockStorage.getAllKeys();
      expect(keys).toContain('key1');
    });

    it('implements multiSet and multiGet', async () => {
      await mockStorage.multiSet([['mk1', 'mv1'], ['mk2', 'mv2']]);
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

  // ===========================================================================
  // 4. Migration Logic
  // ===========================================================================
  describe('Migrations', () => {
    const runMigrate = async (version: number | undefined, state: any) => {
      const migrate = capturedConfig.persistConfig.migrate;
      const persistedState = {
        _persist: { version },
        ...state
      };
      return await migrate(persistedState);
    };

    it('handles v1 -> v2 migration', async () => {
      await runMigrate(1, {});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating from v1 to v2')
      );
    });

    it('handles v2 -> v3 migration (resets businesses)', async () => {
      const oldState = { businesses: { someOldData: true } };
      const newState = await runMigrate(2, oldState);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Migrating from v2 to v3'));
      expect(newState.businesses).toEqual(expect.objectContaining({
        businesses: [],
        employees: [],
        loading: false
      }));
    });

    it('handles v2 -> v3 migration (no businesses slice)', async () => {
      const newState = await runMigrate(2, {});
      expect(newState.businesses).toBeUndefined();
    });

    it('handles v3 -> v4 migration (inits notifications)', async () => {
      const newState = await runMigrate(3, {});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Migrating from v3 to v4'));
      expect(newState.notifications).toEqual(expect.objectContaining({
        items: [],
        unreadCount: 0,
        filter: 'all'
      }));
    });

    it('handles v3 -> v4 migration (skips if notifications exist)', async () => {
      const oldState = { notifications: { existing: true } };
      const newState = await runMigrate(3, oldState);
      expect(newState.notifications).toEqual({ existing: true });
    });

    it('handles v4 -> v5 migration (inits services)', async () => {
      const oldState = { businesses: { businesses: [] } };
      const newState = await runMigrate(4, oldState);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Migrating from v4 to v5'));
      expect(newState.businesses.services).toEqual([]);
    });

    it('handles v4 -> v5 migration (skips if services exist)', async () => {
      const oldState = { businesses: { services: ['exists'] } };
      const newState = await runMigrate(4, oldState);
      expect(newState.businesses.services).toEqual(['exists']);
    });

    it('handles non-matching versions gracefully', async () => {
        // Just ensures it returns the state promise
        const state = { foo: 'bar' };
        const result = await runMigrate(99, state);
        expect(result).toEqual(expect.objectContaining({ foo: 'bar' }));
    });
  });
});