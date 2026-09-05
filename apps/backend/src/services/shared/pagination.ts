/**
 * Keyset pagination primitives shared by the paged list endpoints.
 *
 * Extracted from the developer data plane, which had the only copy. The owner
 * prescription list (#2709) needs the same two decisions, and importing them
 * from `developer-data.service` would pull that module's import graph into an
 * owner-facing read that deliberately has no organisation and no staff RBAC.
 * A shared module is what keeps the two answers identical without coupling the
 * surfaces - the same reason `staff-identity` exists.
 *
 * Bounds are parameters rather than constants here: a developer API page and a
 * phone's list have no reason to be the same size, and baking one surface's
 * numbers in is how the other one silently inherits them.
 */

export type PageSizeBounds = {
  defaultSize: number;
  maxSize: number;
};

/**
 * Clamp rather than reject. A caller asking for 1000 rows gets `maxSize` and a
 * `limit` in the response saying so, which is friendlier to an agent than a 400
 * it has to learn to avoid, and still bounds the query.
 *
 * A non-numeric, absent or sub-1 value is the default rather than an error for
 * the same reason. It cannot return an unbounded page for any input.
 */
export const clampPageSize = (
  raw: unknown,
  { defaultSize, maxSize }: PageSizeBounds,
): number => {
  const parsed =
    typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultSize;
  }
  return Math.min(parsed, maxSize);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cursors are row ids, which are uuids.
 *
 * Three outcomes, not two: `undefined` for "no cursor sent", `null` for "sent
 * and malformed", and the value itself when it is usable. Checking the shape up
 * front is what lets every failure from the query itself be reported honestly
 * as a 500 - the alternative, inferring "bad cursor" from a thrown error, turns
 * a database outage into a 400 telling the caller their cursor is malformed.
 */
export const parseUuidCursor = (raw: unknown): string | undefined | null => {
  if (typeof raw !== "string" || !raw) {
    return undefined;
  }
  return UUID.test(raw) ? raw : null;
};

/**
 * Split a `take: limit + 1` read into the page and whether another one follows.
 *
 * The extra row is the whole mechanism: it is how the endpoint can say there is
 * more without a second count query, and it is why the cursor is taken from the
 * last row of the *page* rather than of the read.
 *
 * `toCursor` defaults to the row id, which is what a surface paging on `id`
 * alone needs. A surface paging on `(createdAt, id)` passes
 * `encodeKeysetCursor`, so the cursor carries the whole sort key rather than
 * half of it.
 */
export const splitPage = <T extends { id: string }>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => string = (row) => row.id,
): { items: T[]; nextCursor: string | null; hasMore: boolean } => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? toCursor(last) : null,
    hasMore,
  };
};

export type KeysetCursor = {
  createdAt: Date;
  id: string;
};

const KEYSET_SEPARATOR = "|";
const KEYSET_MILLIS = /^\d{1,15}$/;

/**
 * A cursor that carries the whole sort key, for `(createdAt, id)` lists.
 *
 * A row id alone is only usable as a cursor through Prisma's `cursor` +
 * `skip: 1`, and that pair is exclusive only while the cursor row is still in
 * the filtered set: `cursor` seeks to the row, `skip` is an OFFSET on the
 * *result*, so once the row leaves the filter the OFFSET eats a legitimate row
 * instead. On this list a vet voiding a prescription takes it out of
 * OWNER_VISIBLE_ARTIFACT_STATUSES and the next page silently loses one - with
 * `hasMore: false` claiming the list was complete. #2720.
 *
 * Carrying `createdAt` as well lets the next page be an exclusive comparison in
 * the `where`, which is exclusive by construction and cannot be affected by a
 * row leaving the set. `createdAt` is `TIMESTAMP(3)` on every model paged this
 * way, so epoch milliseconds round-trip the value exactly.
 *
 * Opaque on purpose - base64url, no padding, URL-safe - so that a caller cannot
 * read a timestamp out of it and start constructing cursors of their own.
 */
export const encodeKeysetCursor = ({ createdAt, id }: KeysetCursor): string =>
  Buffer.from(
    `${createdAt.getTime()}${KEYSET_SEPARATOR}${id}`,
    "utf8",
  ).toString("base64url");

/**
 * Three outcomes, for the same reason `parseUuidCursor` has three: `undefined`
 * for "no cursor sent", `null` for "sent and unusable", the value when it is
 * usable. Every field is re-validated after decoding - base64url decoding does
 * not throw on rubbish, it just returns rubbish, so the shape check is the only
 * thing standing between a hand-made cursor and the query.
 *
 * There is no Invalid Date branch below because the digit bound removes it: 15
 * digits of milliseconds is 999999999999999 and the largest a Date can hold is
 * 8640000000000000, so anything the regex admits is a valid Date.
 */
export const parseKeysetCursor = (
  raw: unknown,
): KeysetCursor | undefined | null => {
  if (typeof raw !== "string" || !raw) {
    return undefined;
  }
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const parts = decoded.split(KEYSET_SEPARATOR);
  if (parts.length !== 2) {
    return null;
  }
  const [millis, id] = parts;
  if (!KEYSET_MILLIS.test(millis) || !UUID.test(id)) {
    return null;
  }
  return { createdAt: new Date(Number(millis)), id };
};
