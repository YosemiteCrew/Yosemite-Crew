import { createOfflineStore, quoteIdent, TableSchema } from '../src/sync/offline-store';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('createOfflineStore', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let db: any;

  const patientSchema: TableSchema = {
    name: 'patients',
    columns: [
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'species', type: 'TEXT' },
      { name: 'breed', type: 'TEXT' },
      { name: 'owner_name', type: 'TEXT' },
    ],
  };

  const appointmentSchema: TableSchema = {
    name: 'appointments',
    columns: [
      { name: 'patient_id', type: 'TEXT', notNull: true },
      { name: 'start_time', type: 'TEXT' },
      { name: 'reason', type: 'TEXT' },
    ],
  };

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
  });

  test('registerTable creates the table', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);

    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'") as any;
    expect(tables[0].values).toContainEqual(['patients']);
  });

  test('insert stores a row and marks it dirty', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });

    const row = store.findById('patients', 'p1') as any;
    expect(row.name).toBe('Buddy');
    expect(row._dirty).toBe(1);
  });

  test('findById returns undefined for missing row', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    expect(store.findById('patients', 'nonexistent')).toBeUndefined();
  });

  test('update modifies a row and marks it dirty', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.update('patients', 'p1', { name: 'Max' });

    const row = store.findById('patients', 'p1') as any;
    expect(row.name).toBe('Max');
    expect(row._dirty).toBe(1);
  });

  test('remove deletes a row', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.remove('patients', 'p1');

    expect(store.findById('patients', 'p1')).toBeUndefined();
  });

  test('findAll returns all rows', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.insert('patients', { id: 'p2', name: 'Max', species: 'Feline' });

    const all = store.findAll('patients');
    expect(all).toHaveLength(2);
  });

  test('query filters rows', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.insert('patients', { id: 'p2', name: 'Whiskers', species: 'Feline' });

    const canines = store.query('patients', { species: 'Canine' });
    expect(canines).toHaveLength(1);
    expect(canines[0].id).toBe('p1');
  });

  test('getDirtyRows returns only dirty rows', async () => {
    const store = await createOfflineStore({ db, SQL, now: () => 1000 });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.insert('patients', { id: 'p2', name: 'Max', species: 'Feline' });
    store.markSynced('patients', ['p1']);

    const dirty = store.getDirtyRows('patients');
    expect(dirty).toHaveLength(1);
    expect(dirty[0].id).toBe('p2');
  });

  test('getDirtyCount returns count', async () => {
    const store = await createOfflineStore({ db, SQL, now: () => 1000 });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.insert('patients', { id: 'p2', name: 'Max', species: 'Feline' });
    store.markSynced('patients', ['p1']);

    expect(store.getDirtyCount('patients')).toBe(1);
  });

  test('markSynced sets dirty to 0', async () => {
    const store = await createOfflineStore({ db, SQL, now: () => 1000 });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.markSynced('patients', ['p1']);

    const row = store.findById('patients', 'p1') as any;
    expect(row._dirty).toBe(0);
    expect(row._synced_at).toBe(1000);
  });

  test('registerTable is idempotent', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.registerTable(patientSchema); // should not throw

    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    expect(store.findAll('patients')).toHaveLength(1);
  });

  test('upsert inserts multiple rows', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.upsert('patients', [
      { id: 'p1', name: 'Buddy', species: 'Canine' },
      { id: 'p2', name: 'Max', species: 'Feline' },
    ]);

    expect(store.findAll('patients')).toHaveLength(2);
  });

  test('save and load round-trip data', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    const saved = store.save();

    const db2 = new SQL.Database(saved);
    const store2 = await createOfflineStore({ db: db2, SQL });
    store2.registerTable(patientSchema);

    const row = store2.findById('patients', 'p1') as any;
    expect(row.name).toBe('Buddy');
  });

  test('close does not throw', async () => {
    const store = await createOfflineStore({ db, SQL });
    expect(() => store.close()).not.toThrow();
  });

  test('throws for unregistered table', async () => {
    const store = await createOfflineStore({ db, SQL });
    expect(() => store.findById('unknown', '1')).toThrow('not registered');
    expect(() => store.findAll('unknown')).toThrow('not registered');
    expect(() => store.insert('unknown', {})).toThrow('not registered');
    expect(() => store.update('unknown', '1', {})).toThrow('not registered');
    expect(() => store.remove('unknown', '1')).toThrow('not registered');
    expect(() => store.getDirtyRows('unknown')).toThrow('not registered');
    expect(() => store.getDirtyCount('unknown')).toThrow('not registered');
    expect(() => store.markSynced('unknown', ['1'])).toThrow('not registered');
    expect(() => store.query('unknown', {})).toThrow('not registered');
  });

  test('multiple tables work independently', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.registerTable(appointmentSchema);

    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.insert('appointments', {
      id: 'a1',
      patient_id: 'p1',
      reason: 'Annual checkup',
    });

    const patients = store.findAll('patients');
    const appointments = store.findAll('appointments');
    expect(patients).toHaveLength(1);
    expect(appointments).toHaveLength(1);
  });

  test('quoteIdent throws for invalid identifiers', () => {
    expect(() => quoteIdent('')).toThrow('Invalid SQL identifier');
    expect(() => quoteIdent('bad\x00id')).toThrow('Invalid SQL identifier');
  });

  test('quoteIdent doubles embedded quotes', () => {
    expect(quoteIdent('test"name')).toBe('"test""name"');
    expect(quoteIdent('normal')).toBe('"normal"');
  });

  test('markSynced with empty array does nothing', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    const rowBefore = store.findById('patients', 'p1') as any;

    store.markSynced('patients', []);

    const rowAfter = store.findById('patients', 'p1') as any;
    expect(rowAfter._dirty).toBe(rowBefore._dirty);
  });

  test('query without filters returns all rows', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    store.insert('patients', { id: 'p2', name: 'Max', species: 'Feline' });

    expect(store.query('patients')).toHaveLength(2);
    expect(store.query('patients', {})).toHaveLength(2);
  });

  test('loadFile restores database from disk', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-store-test-'));
    try {
      const store = await createOfflineStore({ db, SQL });
      store.registerTable(patientSchema);
      store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
      const saved = store.save();

      const filePath = path.join(tmpDir, 'test.db');
      fs.writeFileSync(filePath, saved);

      store.loadFile(filePath);
      const row = store.findById('patients', 'p1') as any;
      expect(row.name).toBe('Buddy');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('loadFile does nothing when file does not exist', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });

    store.loadFile('/nonexistent/path.db');
    const row = store.findById('patients', 'p1') as any;
    expect(row.name).toBe('Buddy');
  });

  test('createOfflineStore with just SQL (no db)', async () => {
    const store = await createOfflineStore({ SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    const row = store.findById('patients', 'p1') as any;
    expect(row.name).toBe('Buddy');
  });

  test('createOfflineStore uses default now when not provided', async () => {
    const store = await createOfflineStore({ db, SQL });
    store.registerTable(patientSchema);
    store.insert('patients', { id: 'p1', name: 'Buddy', species: 'Canine' });
    const row = store.findById('patients', 'p1') as any;
    expect(typeof row._synced_at).toBe('number');
  });
});
