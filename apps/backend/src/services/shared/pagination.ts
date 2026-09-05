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
 */
export const splitPage = <T extends { id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null; hasMore: boolean } => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.id : null, hasMore };
};
