'use strict';

import fs from 'node:fs';
import type { SqlJsStatic, Database as SqlJsDatabase } from 'sql.js';

// Values accepted as SQL bind parameters by sql.js.
type SqlParam = number | string | Uint8Array | null;

export interface TableSchema {
  name: string;
  columns: ColumnDef[];
  primaryKey?: string;
}

export interface ColumnDef {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
  notNull?: boolean;
  default?: string;
}

export interface OfflineStore {
  isReady: boolean;
  registerTable: (schema: TableSchema) => void;
  insert: (table: string, row: Record<string, unknown>) => void;
  upsert: (table: string, rows: Record<string, unknown>[]) => void;
  update: (table: string, id: string, changes: Record<string, unknown>) => void;
  remove: (table: string, id: string) => void;
  findById: (table: string, id: string) => Record<string, unknown> | undefined;
  findAll: (table: string) => Record<string, unknown>[];
  query: (table: string, filters?: Record<string, unknown>) => Record<string, unknown>[];
  getDirtyRows: (table: string) => Record<string, unknown>[];
  getDirtyCount: (table: string) => number;
  markSynced: (table: string, ids: string[]) => void;
  loadFile: (path: string) => void;
  save: () => Uint8Array;
  close: () => void;
}

interface StoreDeps {
  SQL?: SqlJsStatic;
  db?: SqlJsDatabase;
  now?: () => number;
}

const META_COLUMNS: ColumnDef[] = [
  { name: '_dirty', type: 'INTEGER', notNull: true, default: '1' },
  { name: '_synced_at', type: 'INTEGER' },
];

const dirtyFilter = 'WHERE _dirty = 1';

// SQLite identifier quoting: double any embedded quote and reject NUL bytes.
// Table and column names can originate from synced server data, so they must
// never be interpolated into SQL raw. (Bound values are already parameterized.)
const NUL = String.fromCodePoint(0);
export const quoteIdent = (id: string): string => {
  if (typeof id !== 'string' || id.length === 0 || id.includes(NUL)) {
    throw new Error('Invalid SQL identifier');
  }
  return `"${id.replaceAll('"', '""')}"`;
};

export const createOfflineStore = async (deps: StoreDeps = {}): Promise<OfflineStore> => {
  const now = deps.now || (() => Date.now());
  let db: SqlJsDatabase;

  if (deps.db) {
    db = deps.db;
  } else if (deps.SQL) {
    db = new deps.SQL.Database();
  } else {
    const sqlJsMod = await import('sql.js');
    const initSqlJs: () => Promise<SqlJsStatic> =
      typeof sqlJsMod === 'function' ? sqlJsMod : sqlJsMod.default;
    const SQL = await initSqlJs();
    db = new SQL.Database();
  }

  const registered = new Set<string>();

  const isReady = true;

  const registerTable = (schema: TableSchema): void => {
    if (registered.has(schema.name)) return;
    registered.add(schema.name);

    const pk = schema.primaryKey || 'id';
    const allCols = [
      { name: pk, type: 'TEXT' as const, notNull: true },
      ...schema.columns.filter((c) => c.name !== pk),
      ...META_COLUMNS,
    ];

    const colDefs = allCols.map((c) => {
      let def = `${quoteIdent(c.name)} ${c.type}`;
      if (c.notNull) def += ' NOT NULL';
      if (c.default !== undefined) def += ` DEFAULT ${c.default}`;
      return def;
    });

    const sql = `CREATE TABLE IF NOT EXISTS ${quoteIdent(schema.name)} (${colDefs.join(', ')}, PRIMARY KEY (${quoteIdent(pk)}))`;
    db.run(sql);
  };

  const exec = (sql: string, params?: SqlParam[]): void => {
    if (params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
    } else {
      db.run(sql);
    }
  };

  const queryAll = (sql: string, params?: SqlParam[]): Record<string, unknown>[] => {
    const results: Record<string, unknown>[] = [];
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  };

  const queryOne = (sql: string, params?: SqlParam[]): Record<string, unknown> | undefined => {
    const rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : undefined;
  };

  const insert = (table: string, row: Record<string, unknown>): void => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    const ts = now();
    const cols = Object.keys(row);
    const placeholders = cols.map(() => '?').join(', ');
    const colNames = cols.map((c) => `${quoteIdent(c)}`).join(', ');
    const sql = `INSERT OR REPLACE INTO ${quoteIdent(table)} (${colNames}, _dirty, _synced_at) VALUES (${placeholders}, ?, ?)`;
    const values = cols.map((c) => row[c]) as SqlParam[];
    exec(sql, [...values, 1, ts]);
  };

  const upsert = (table: string, rows: Record<string, unknown>[]): void => {
    for (const row of rows) insert(table, row);
  };

  const update = (table: string, id: string, changes: Record<string, unknown>): void => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    const keys = Object.keys(changes);
    const setClause = keys.map((c) => `${quoteIdent(c)} = ?`).join(', ');
    const sql = `UPDATE ${quoteIdent(table)} SET ${setClause}, _dirty = 1, _synced_at = ? WHERE "id" = ?`;
    const values = keys.map((c) => changes[c]) as SqlParam[];
    exec(sql, [...values, now(), id]);
  };

  const remove = (table: string, id: string): void => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    exec(`DELETE FROM ${quoteIdent(table)} WHERE "id" = ?`, [id]);
  };

  const findById = (table: string, id: string): Record<string, unknown> | undefined => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    return queryOne(`SELECT * FROM ${quoteIdent(table)} WHERE "id" = ?`, [id]);
  };

  const findAll = (table: string): Record<string, unknown>[] => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    return queryAll(`SELECT * FROM ${quoteIdent(table)}`);
  };

  const query = (table: string, filters?: Record<string, unknown>): Record<string, unknown>[] => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    if (!filters || Object.keys(filters).length === 0) return findAll(table);
    const keys = Object.keys(filters);
    const where = keys.map((c) => `${quoteIdent(c)} = ?`).join(' AND ');
    const values = keys.map((c) => filters[c]) as SqlParam[];
    return queryAll(`SELECT * FROM ${quoteIdent(table)} WHERE ${where}`, values);
  };

  const getDirtyRows = (table: string): Record<string, unknown>[] => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    return queryAll(`SELECT * FROM ${quoteIdent(table)} ${dirtyFilter}`);
  };

  const getDirtyCount = (table: string): number => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    const row = queryOne(`SELECT COUNT(*) as cnt FROM ${quoteIdent(table)} ${dirtyFilter}`);
    return (row?.cnt as number) || 0;
  };

  const markSynced = (table: string, ids: string[]): void => {
    if (!registered.has(table)) throw new Error(`Table ${quoteIdent(table)} not registered`);
    if (ids.length === 0) return;
    const ts = now();
    const placeholders = ids.map(() => '?').join(', ');
    exec(
      `UPDATE ${quoteIdent(table)} SET _dirty = 0, _synced_at = ? WHERE "id" IN (${placeholders})`,
      [ts, ...ids]
    );
  };

  const loadFile = (filePath: string): void => {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      db = new (db.constructor as new (data?: Uint8Array) => SqlJsDatabase)(buffer);
    }
  };

  const save = (): Uint8Array => db.export();

  const close = (): void => {
    db.close();
  };

  return {
    isReady,
    registerTable,
    insert,
    upsert,
    update,
    remove,
    findById,
    findAll,
    query,
    getDirtyRows,
    getDirtyCount,
    markSynced,
    loadFile,
    save,
    close,
  };
};
