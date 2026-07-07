import {
  DEFAULT_LIMIT,
  InvalidCursorError,
  buildListPage,
  clampLimit,
  decodeCursor,
  encodeCursor,
  keysetWhere,
} from "../../src/utils/cursor-pagination";

describe("clampLimit", () => {
  it("defaults to 50 when no limit is given", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_LIMIT);
  });

  it("clamps below 1 up to 1", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
  });

  it("clamps above 100 down to 100", () => {
    expect(clampLimit(101)).toBe(100);
    expect(clampLimit(5000)).toBe(100);
  });

  it("passes through in-range values, truncating fractions", () => {
    expect(clampLimit(25)).toBe(25);
    expect(clampLimit(25.9)).toBe(25);
    expect(clampLimit(1)).toBe(1);
    expect(clampLimit(100)).toBe(100);
  });
});

describe("encodeCursor / decodeCursor", () => {
  it("round-trips a payload with a sort key", () => {
    const payload = { sortKey: "2026-07-01T00:00:00.000Z", id: "row-1" };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it("round-trips a null sort key", () => {
    const payload = { sortKey: null, id: "row-2" };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it("produces url-safe tokens (no +, /, or =)", () => {
    const token = encodeCursor({ sortKey: "a?b&c=d", id: "x/y+z" });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("throws InvalidCursorError on garbage input", () => {
    expect(() => decodeCursor("not-a-cursor")).toThrow(InvalidCursorError);
  });

  it("throws InvalidCursorError on valid base64url of non-JSON", () => {
    const raw = Buffer.from("hello world", "utf8").toString("base64url");
    expect(() => decodeCursor(raw)).toThrow(InvalidCursorError);
  });

  it("throws InvalidCursorError when the id is missing or empty", () => {
    const noId = Buffer.from(JSON.stringify({ sortKey: "x" })).toString(
      "base64url",
    );
    const emptyId = Buffer.from(
      JSON.stringify({ sortKey: "x", id: "" }),
    ).toString("base64url");
    expect(() => decodeCursor(noId)).toThrow(InvalidCursorError);
    expect(() => decodeCursor(emptyId)).toThrow(InvalidCursorError);
  });

  it("throws InvalidCursorError on a tampered sort key type", () => {
    const raw = Buffer.from(JSON.stringify({ sortKey: 42, id: "k" })).toString(
      "base64url",
    );
    expect(() => decodeCursor(raw)).toThrow(InvalidCursorError);
  });

  it("throws InvalidCursorError on JSON scalars and null", () => {
    for (const value of ["42", "null", '"str"']) {
      const raw = Buffer.from(value, "utf8").toString("base64url");
      expect(() => decodeCursor(raw)).toThrow(InvalidCursorError);
    }
  });
});

describe("keysetWhere", () => {
  const when = new Date("2026-07-01T12:30:00.000Z");

  it("returns undefined without a cursor (first page)", () => {
    expect(keysetWhere("createdAt")).toBeUndefined();
    expect(keysetWhere("createdAt", undefined)).toBeUndefined();
  });

  it("builds the descending compound-key predicate, reviving the ISO sort key to a Date", () => {
    const token = encodeCursor({ sortKey: when.toISOString(), id: "row-9" });
    expect(keysetWhere("appointmentDate", token)).toEqual({
      OR: [
        { appointmentDate: { lt: when } },
        { appointmentDate: when, id: { lt: "row-9" } },
      ],
    });
  });

  it("breaks ties on equal sort keys by id strictly less than the cursor id", () => {
    const token = encodeCursor({ sortKey: when.toISOString(), id: "row-5" });
    const clause = keysetWhere("createdAt", token) as {
      OR: Array<Record<string, unknown>>;
    };
    // The tie branch pins the exact sort value and continues by descending id,
    // so rows sharing the timestamp are neither skipped nor repeated.
    expect(clause.OR[1]).toEqual({ createdAt: when, id: { lt: "row-5" } });
  });

  it("continues past a null sort key: rest of the null block by id, then all non-null rows", () => {
    const token = encodeCursor({ sortKey: null, id: "row-3" });
    expect(keysetWhere("periodStart", token)).toEqual({
      OR: [
        { periodStart: null, id: { lt: "row-3" } },
        { periodStart: { not: null } },
      ],
    });
  });

  it("never emits a Prisma cursor/skip positioning argument", () => {
    // Keyset continuation must be pure WHERE: a Prisma `cursor: { id }` would
    // position on the row itself, so a deleted cursor row truncates the scan
    // and a forged id becomes a cross-org existence oracle.
    const token = encodeCursor({ sortKey: when.toISOString(), id: "gone-row" });
    const clause = keysetWhere("createdAt", token) as Record<string, unknown>;
    expect(clause.cursor).toBeUndefined();
    expect(clause.skip).toBeUndefined();
    expect(Object.keys(clause)).toEqual(["OR"]);
  });

  it("produces an identical predicate shape for any embedded id (forged-id indistinguishability)", () => {
    // Whether the id belongs to another org's row or to nothing at all, the
    // predicate only compares column values on rows the caller can already
    // see - the id never selects a row by itself.
    const foreign = keysetWhere(
      "createdAt",
      encodeCursor({ sortKey: when.toISOString(), id: "other-orgs-row" }),
    );
    const nonexistent = keysetWhere(
      "createdAt",
      encodeCursor({ sortKey: when.toISOString(), id: "no-such-row" }),
    );
    expect(foreign).toEqual({
      OR: [
        { createdAt: { lt: when } },
        { createdAt: when, id: { lt: "other-orgs-row" } },
      ],
    });
    expect(nonexistent).toEqual({
      OR: [
        { createdAt: { lt: when } },
        { createdAt: when, id: { lt: "no-such-row" } },
      ],
    });
  });

  it("survives deletion of the cursor row (predicate depends only on token values)", () => {
    // The clause is derived purely from the token, so deleting the row the
    // cursor was minted from cannot shift or truncate the continuation.
    const token = encodeCursor({ sortKey: when.toISOString(), id: "deleted" });
    expect(keysetWhere("createdAt", token)).toEqual(
      keysetWhere("createdAt", token),
    );
  });

  it("throws InvalidCursorError on a tampered token", () => {
    expect(() => keysetWhere("createdAt", "@@@")).toThrow(InvalidCursorError);
  });

  it("throws InvalidCursorError when the sort key does not revive to a valid date", () => {
    const token = encodeCursor({ sortKey: "not-a-date", id: "row-1" });
    expect(() => keysetWhere("createdAt", token)).toThrow(InvalidCursorError);
  });
});

describe("buildListPage", () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `row-${i}`,
      createdAt: new Date(Date.UTC(2026, 0, n - i)),
    }));

  it("reports hasMore and a nextCursor when an extra row came back", () => {
    const page = buildListPage(rows(3), 2, "createdAt");
    expect(page.items).toHaveLength(2);
    expect(page.pagination.hasMore).toBe(true);
    expect(page.pagination.limit).toBe(2);
    expect(page.pagination.nextCursor).not.toBeNull();
    const decoded = decodeCursor(page.pagination.nextCursor as string);
    expect(decoded.id).toBe("row-1");
    expect(decoded.sortKey).toBe(rows(3)[1].createdAt.toISOString());
  });

  it("reports no next page when rows fit the limit", () => {
    const page = buildListPage(rows(2), 2, "createdAt");
    expect(page.items).toHaveLength(2);
    expect(page.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
      limit: 2,
    });
  });

  it("handles an empty result", () => {
    const page = buildListPage([] as { id: string }[], 50, "createdAt");
    expect(page.items).toEqual([]);
    expect(page.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
      limit: 50,
    });
  });

  it("serialises a null sort key", () => {
    const data = [
      { id: "a", when: null },
      { id: "b", when: null },
    ];
    const page = buildListPage(data, 1, "when");
    expect(decodeCursor(page.pagination.nextCursor as string)).toEqual({
      sortKey: null,
      id: "a",
    });
  });

  it("round-trips into keysetWhere: the emitted cursor continues after the last item", () => {
    const page = buildListPage(rows(3), 2, "createdAt");
    const clause = keysetWhere(
      "createdAt",
      page.pagination.nextCursor as string,
    );
    expect(clause).toEqual({
      OR: [
        { createdAt: { lt: rows(3)[1].createdAt } },
        { createdAt: rows(3)[1].createdAt, id: { lt: "row-1" } },
      ],
    });
  });
});
