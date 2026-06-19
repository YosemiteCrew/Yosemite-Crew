import { createOfflineStore, TableSchema } from '../src/sync/offline-store';
import { createSyncEngine, SyncTransport } from '../src/sync/sync-engine';
import initSqlJs from 'sql.js';

describe('createSyncEngine', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let db: any;

  const patientSchema: TableSchema = {
    name: 'patients',
    columns: [
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'species', type: 'TEXT' },
    ],
  };

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
  });

  test('pushDirtyRows pushes dirty rows and marks them synced', async () => {
    const store = await createOfflineStore({ db, SQL, now: () => 1000 });
    store.registerTable(patientSchema);

    const transport: SyncTransport = {
      fetchChanges: jest.fn().mockResolvedValue([]),
      upsertRows: jest.fn().mockResolvedValue({ success: true }),
    };

    const engine = createSyncEngine({ store, transport, now: () => 2000 });

    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.insert('patients', { id: 'p2', name: 'Max', species: 'Feline' });

    const result = await engine.pushDirtyRows('patients');
    expect(result.pushed).toBe(2);
    expect(transport.upsertRows).toHaveBeenCalledWith(
      'patients',
      expect.arrayContaining([expect.objectContaining({ id: 'p1', name: 'Buddy' })])
    );
    expect(transport.upsertRows).toHaveBeenCalledWith(
      'patients',
      expect.arrayContaining([expect.objectContaining({ id: 'p2', name: 'Max' })])
    );

    // verify stripped meta fields from payload
    const payload = (transport.upsertRows as jest.Mock).mock.calls[0][1];
    expect(payload[0]._dirty).toBeUndefined();
    expect(payload[0]._synced_at).toBeUndefined();

    // verify local rows are marked synced
    expect(store.getDirtyCount('patients')).toBe(0);
  });

  test('pushDirtyRows handles empty dirty queue', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);

    const transport: SyncTransport = {
      fetchChanges: jest.fn().mockResolvedValue([]),
      upsertRows: jest.fn(),
    };

    const engine = createSyncEngine({ store, transport });
    const result = await engine.pushDirtyRows('patients');
    expect(result.pushed).toBe(0);
    expect(transport.upsertRows).not.toHaveBeenCalled();
  });

  test('pushDirtyRows captures errors', async () => {
    const store = await createOfflineStore({ db, SQL, now: () => 1000 });
    store.registerTable(patientSchema);

    const transport: SyncTransport = {
      fetchChanges: jest.fn().mockResolvedValue([]),
      upsertRows: jest.fn().mockResolvedValue({ success: false, errors: ['Network error'] }),
    };

    const engine = createSyncEngine({ store, transport });
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });

    const result = await engine.pushDirtyRows('patients');
    expect(result.pushed).toBe(0);
    expect(result.errors).toContain('Network error');
  });

  test('pullChanges fetches server rows and upserts locally', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);

    const transport: SyncTransport = {
      fetchChanges: jest
        .fn()
        .mockResolvedValue([{ id: 's1', name: 'Server Pet', species: 'Avian' }]),
      upsertRows: jest.fn().mockResolvedValue({ success: true }),
    };

    const engine = createSyncEngine({ store, transport });
    const result = await engine.pullChanges('patients', 1000);

    expect(result.pulled).toBe(1);
    expect(transport.fetchChanges).toHaveBeenCalledWith('patients', 1000);

    const row = store.findById('patients', 's1') as any;
    expect(row.name).toBe('Server Pet');
    expect(row._dirty).toBe(0); // pulled rows are not dirty
  });

  test('fullSync pushes and pulls for each table', async () => {
    const store = await createOfflineStore({ db, SQL, now: () => 1000 });
    const apptSchema: TableSchema = {
      name: 'appointments',
      columns: [
        { name: 'patient_id', type: 'TEXT' },
        { name: 'reason', type: 'TEXT' },
      ],
    };
    store.registerTable(patientSchema);
    store.registerTable(apptSchema);

    const transport: SyncTransport = {
      fetchChanges: jest.fn().mockResolvedValue([]),
      upsertRows: jest.fn().mockResolvedValue({ success: true }),
    };

    const engine = createSyncEngine({ store, transport });
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });

    const results = await engine.fullSync(['patients', 'appointments']);
    expect(results).toHaveLength(2);
    expect(results[0].table).toBe('patients');
    expect(results[0].pushed).toBe(1);
    expect(results[1].table).toBe('appointments');
  });

  test('getLastSyncTimestamps returns empty initially', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    const transport: SyncTransport = {
      fetchChanges: jest.fn().mockResolvedValue([]),
      upsertRows: jest.fn().mockResolvedValue({ success: true }),
    };
    const engine = createSyncEngine({ store, transport });
    expect(engine.getLastSyncTimestamps()).toEqual({});
  });

  test('setLastSyncTimestamps restores timestamps', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    const transport: SyncTransport = {
      fetchChanges: jest.fn().mockResolvedValue([]),
      upsertRows: jest.fn().mockResolvedValue({ success: true }),
    };
    const engine = createSyncEngine({ store, transport });
    engine.setLastSyncTimestamps({ patients: 5000 });
    expect(engine.getLastSyncTimestamps()).toEqual({ patients: 5000 });
  });

  test('initialSyncTimestamps applied at construction', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    const transport: SyncTransport = {
      fetchChanges: jest.fn().mockResolvedValue([]),
      upsertRows: jest.fn().mockResolvedValue({ success: true }),
    };
    const engine = createSyncEngine({
      store,
      transport,
      initialSyncTimestamps: { patients: 9999 },
    });
    expect(engine.getLastSyncTimestamps()).toEqual({ patients: 9999 });
  });

  test('fullSync uses lastSyncAt timestamp for pullChanges', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);

    const fetchChanges = jest
      .fn()
      .mockResolvedValue([{ id: 's1', name: 'Changed', species: 'Avian' }]);
    const transport: SyncTransport = {
      fetchChanges,
      upsertRows: jest.fn().mockResolvedValue({ success: true }),
    };

    const engine = createSyncEngine({
      store,
      transport,
      initialSyncTimestamps: { patients: 2000 },
      now: () => 3000,
    });
    await engine.fullSync(['patients']);

    expect(fetchChanges).toHaveBeenCalledWith('patients', 2000);
    expect(engine.getLastSyncTimestamps().patients).toBe(3000);
  });

  test('subsequent fullSync uses updated timestamp', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);

    const fetchChanges = jest.fn().mockResolvedValue([]);
    const transport: SyncTransport = {
      fetchChanges,
      upsertRows: jest.fn().mockResolvedValue({ success: true }),
    };

    let currentTime = 1000;
    const engine = createSyncEngine({
      store,
      transport,
      initialSyncTimestamps: { patients: 500 },
      now: () => currentTime,
    });

    await engine.fullSync(['patients']);
    expect(fetchChanges).toHaveBeenCalledWith('patients', 500);

    fetchChanges.mockClear();
    currentTime = 2000;
    await engine.fullSync(['patients']);
    expect(fetchChanges).toHaveBeenCalledWith('patients', 1000);
  });

  test('handles transport throwing an error', async () => {
    const store = await createOfflineStore({ db, SQL, now: () => 1000 });
    store.registerTable(patientSchema);

    const transport: SyncTransport = {
      fetchChanges: jest.fn().mockRejectedValue(new Error('Server unreachable')),
      upsertRows: jest.fn().mockRejectedValue(new Error('Server unreachable')),
    };

    const engine = createSyncEngine({ store, transport });
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });

    const pushResult = await engine.pushDirtyRows('patients');
    expect(pushResult.errors).toHaveLength(1);
    expect(pushResult.errors[0]).toContain('Server unreachable');

    const pullResult = await engine.pullChanges('patients');
    expect(pullResult.errors).toHaveLength(1);
    expect(pullResult.errors[0]).toContain('Server unreachable');
  });
});
