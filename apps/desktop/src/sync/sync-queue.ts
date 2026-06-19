'use strict';

import fs from 'node:fs';
import path from 'node:path';

export type MutationType = 'create' | 'update' | 'delete';

export interface Mutation {
  id: string;
  type: MutationType;
  entityType: string;
  entityId: string;
  data: Record<string, unknown> | null;
  timestamp: number;
  retryCount: number;
}

export interface SyncQueue {
  push: (mutation: Omit<Mutation, 'id' | 'timestamp' | 'retryCount'>) => Mutation;
  peek: (limit?: number) => Mutation[];
  pop: (id: string) => boolean;
  markFailed: (id: string) => Mutation | null;
  getFailed: () => Mutation[];
  getPending: () => Mutation[];
  clear: () => void;
  size: () => number;
  getAll: () => Mutation[];
}

interface QueueDeps {
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  existsSync?: typeof fs.existsSync;
  now?: () => number;
}

const QUEUE_FILENAME = 'sync-queue.json';
const MAX_RETRIES = 5;

let idCounter = 0;

const generateId = (): string => `mutation-${Date.now()}-${++idCounter}`;

export const createSyncQueue = (dirPath: string, deps: QueueDeps = {}): SyncQueue => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const existsSync = deps.existsSync || fs.existsSync;
  const now = deps.now || (() => Date.now());
  const filePath = path.join(dirPath, QUEUE_FILENAME);

  const load = (): Mutation[] => {
    try {
      if (!existsSync(filePath)) return [];
      const raw = readFileSync(filePath, 'utf8');
      const entries: Mutation[] = JSON.parse(raw);
      if (!Array.isArray(entries)) return [];
      return entries.filter(
        (e) =>
          typeof e.id === 'string' &&
          typeof e.type === 'string' &&
          typeof e.entityType === 'string' &&
          typeof e.entityId === 'string'
      );
    } catch {
      return [];
    }
  };

  const save = (entries: Mutation[]): void => {
    try {
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(filePath, JSON.stringify(entries), 'utf8');
    } catch {
      // persist must never break the app
    }
  };

  const push = (mutation: Omit<Mutation, 'id' | 'timestamp' | 'retryCount'>): Mutation => {
    const entry: Mutation = {
      ...mutation,
      id: generateId(),
      timestamp: now(),
      retryCount: 0,
    };
    const entries = load();
    entries.push(entry);
    save(entries);
    return entry;
  };

  const peek = (limit = 10): Mutation[] => {
    const entries = load();
    return entries.slice(0, limit);
  };

  const pop = (id: string): boolean => {
    const entries = load();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    entries.splice(idx, 1);
    save(entries);
    return true;
  };

  const markFailed = (id: string): Mutation | null => {
    const entries = load();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return null;
    entry.retryCount += 1;
    save(entries);
    return entry;
  };

  const getFailed = (): Mutation[] => load().filter((e) => e.retryCount >= MAX_RETRIES);
  const getPending = (): Mutation[] => load().filter((e) => e.retryCount < MAX_RETRIES);
  const clear = (): void => save([]);
  const size = (): number => load().length;
  const getAll = (): Mutation[] => load();

  return {
    push,
    peek,
    pop,
    markFailed,
    getFailed,
    getPending,
    clear,
    size,
    getAll,
  };
};
