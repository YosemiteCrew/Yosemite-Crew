import { createSyncQueue } from '../src/sync/sync-queue';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('createSyncQueue', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-queue-test-'));
  let mockFs: Record<string, string> = {};

  const makeDeps = () => ({
    readFileSync: jest.fn((filePath: string) => {
      if (mockFs[filePath] !== undefined) return mockFs[filePath];
      throw new Error('ENOENT');
    }),
    writeFileSync: jest.fn((filePath: string, data: string) => {
      mockFs[filePath] = data;
    }),
    mkdirSync: jest.fn(),
    existsSync: jest.fn((filePath: string) => mockFs[filePath] !== undefined),
    now: jest.fn(() => 1000),
  });

  beforeEach(() => {
    mockFs = {};
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('push adds a mutation to the queue', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    const mutation = queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: { name: 'Buddy' },
    });

    expect(mutation.id).toBeDefined();
    expect(mutation.type).toBe('create');
    expect(mutation.entityType).toBe('patient');
    expect(mutation.entityId).toBe('p1');
    expect(mutation.retryCount).toBe(0);
    expect(mutation.timestamp).toBe(1000);
    expect(queue.size()).toBe(1);
  });

  test('peek returns the first N mutations', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: {},
    });
    queue.push({
      type: 'update',
      entityType: 'patient',
      entityId: 'p2',
      data: {},
    });

    const batch = queue.peek(1);
    expect(batch).toHaveLength(1);
    expect(batch[0].entityId).toBe('p1');
  });

  test('pop removes a mutation by id', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    const m = queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: {},
    });
    expect(queue.pop(m.id)).toBe(true);
    expect(queue.size()).toBe(0);
  });

  test('pop returns false for unknown id', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);
    expect(queue.pop('nonexistent')).toBe(false);
  });

  test('markFailed increments retryCount', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    const m = queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: {},
    });
    const marked = queue.markFailed(m.id);

    expect(marked).not.toBeNull();
    expect(marked!.retryCount).toBe(1);
  });

  test('markFailed keeps mutation and increments retryCount past MAX_RETRIES', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    const m = queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: {},
    });
    for (let i = 0; i < 6; i++) {
      queue.markFailed(m.id);
    }
    const entry = queue.getAll().find((e) => e.id === m.id);
    expect(entry).toBeDefined();
    expect(entry!.retryCount).toBe(6);
    expect(queue.size()).toBe(1);
  });

  test('clear removes all mutations', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: {},
    });
    queue.push({
      type: 'create',
      entityType: 'appointment',
      entityId: 'a1',
      data: {},
    });

    queue.clear();
    expect(queue.size()).toBe(0);
  });

  test('getFailed returns mutations past max retries', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    const m = queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: {},
    });
    for (let i = 0; i < 6; i++) {
      queue.markFailed(m.id);
    }

    expect(queue.getFailed()).toHaveLength(1);
    expect(queue.getPending()).toHaveLength(0);
    expect(queue.size()).toBe(1);
  });

  test('getPending returns mutations still within retry limit', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    const m = queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: {},
    });
    queue.markFailed(m.id); // retryCount becomes 1

    expect(queue.getFailed()).toHaveLength(0);
    expect(queue.getPending()).toHaveLength(1);
  });

  test('getAll returns all mutations', () => {
    const deps = makeDeps();
    const queue = createSyncQueue(tmpDir, deps);

    queue.push({
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      data: {},
    });
    queue.push({
      type: 'update',
      entityType: 'patient',
      entityId: 'p2',
      data: {},
    });

    expect(queue.getAll()).toHaveLength(2);
  });

  test('load returns empty array when stored data is not an array', () => {
    const deps = makeDeps();
    mockFs[path.join(tmpDir, 'sync-queue.json')] = '{"not": "an array"}';
    const queue = createSyncQueue(tmpDir, deps);
    expect(queue.getAll()).toHaveLength(0);
  });

  test('save errors are caught gracefully', () => {
    const deps = makeDeps();
    deps.writeFileSync = jest.fn(() => {
      throw new Error('write failed');
    });
    const queue = createSyncQueue(tmpDir, deps);
    expect(() =>
      queue.push({
        type: 'create',
        entityType: 'patient',
        entityId: 'p1',
        data: {},
      })
    ).not.toThrow();
    expect(queue.getAll()).toHaveLength(0); // write failed so data not persisted
  });
});
