// Opaque cursor pagination helpers for the developer data plane (contract 5.1).
// Cursors are base64url-encoded JSON carrying the last row's sort key + id;
// clients must treat them as opaque tokens.
//
// Continuation is a keyset WHERE predicate, never Prisma `cursor: { id }`.
// A Prisma cursor positions the scan on the row itself, which has two failure
// modes: a forged token embedding a foreign id becomes a cross-org existence /
// sort-position oracle, and deleting the cursor row silently truncates the
// scan. The keyset predicate below compares only against values carried in the
// token and is always AND-merged with the caller's org-scoped filter, so a
// forged token partitions nothing but the caller's own rows (identical results
// whether the embedded id exists in another org or nowhere), and a deleted
// cursor row cannot lose the position.

export class InvalidCursorError extends Error {
  constructor() {
    super("Invalid pagination cursor");
    this.name = "InvalidCursorError";
  }
}

export type CursorPayload = {
  // ISO serialisation of the last row's sort column (null when the column is null).
  sortKey: string | null;
  id: string;
};

const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 50;

// Clamps a requested page size into the contract's 1-100 window, defaulting to 50.
export const clampLimit = (limit?: number): number => {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(limit)));
};

export const encodeCursor = (payload: CursorPayload): string =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

// Decodes and validates a client-presented cursor. Any tampered or malformed
// token throws InvalidCursorError, which controllers map to 400 invalid_request.
export const decodeCursor = (raw: string): CursorPayload => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new InvalidCursorError();
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidCursorError();
  }
  const { sortKey, id } = parsed as Record<string, unknown>;
  if (typeof id !== "string" || id.length === 0) {
    throw new InvalidCursorError();
  }
  if (sortKey !== null && typeof sortKey !== "string") {
    throw new InvalidCursorError();
  }
  return { sortKey, id };
};

// All v1 list sorts run on DateTime columns (contract fixes them per resource),
// so a non-null sort key must revive from its ISO serialisation to a Date for
// the Prisma comparison. Anything that does not parse is a tampered token.
const reviveDateSortKey = (sortKey: string): Date => {
  const revived = new Date(sortKey);
  if (Number.isNaN(revived.getTime())) {
    throw new InvalidCursorError();
  }
  return revived;
};

// Builds the keyset WHERE fragment that continues a descending
// orderBy: [{ <sortField>: "desc" }, { id: "desc" }] scan strictly after the
// cursor position. Returns undefined when no cursor is presented (first page).
// Callers must AND-merge the fragment into their org-scoped where clause.
export const keysetWhere = (
  sortField: string,
  cursor?: string,
): Record<string, unknown> | undefined => {
  if (!cursor) {
    return undefined;
  }
  const { sortKey, id } = decodeCursor(cursor);
  if (sortKey === null) {
    // The cursor row's sort column was null. Postgres sorts nulls first under
    // DESC, so continue within the null block by id, then take every non-null
    // row. On a non-nullable column this degrades to "everything", which is
    // the same harmless result as any other self-inflicted forged token.
    return {
      OR: [
        { [sortField]: null, id: { lt: id } },
        { [sortField]: { not: null } },
      ],
    };
  }
  const value = reviveDateSortKey(sortKey);
  return {
    OR: [
      { [sortField]: { lt: value } },
      { [sortField]: value, id: { lt: id } },
    ],
  };
};

export type ListPagination = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type ListPage<T> = { items: T[]; pagination: ListPagination };

const serializeSortKey = (value: unknown): string | null => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === "string" ? value : null;
};

// Turns limit+1 fetched rows into the page items and the pagination envelope.
// sortField names the column the query is ordered by; its value on the last
// row is embedded in the cursor alongside the row id.
export const buildListPage = <T extends { id: string }>(
  rows: T[],
  limit: number,
  sortField: string,
): ListPage<T> => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortKey: serializeSortKey(
            (last as Record<string, unknown>)[sortField],
          ),
          id: last.id,
        })
      : null;
  return { items, pagination: { nextCursor, hasMore, limit } };
};
