import {
  clampPageSize,
  encodeKeysetCursor,
  parseKeysetCursor,
  parseUuidCursor,
  splitPage,
} from "src/services/shared/pagination";

const BOUNDS = { defaultSize: 20, maxSize: 100 };

describe("clampPageSize", () => {
  it.each([
    ["a value inside the bounds", "7", 7],
    ["the ceiling itself", "100", 100],
    ["above the ceiling", "5000", 100],
    ["not a number", "lots", 20],
    ["empty", "", 20],
    ["zero", "0", 20],
    ["negative", "-1", 20],
  ])("returns %s", (_label, raw, expected) => {
    expect(clampPageSize(raw, BOUNDS)).toBe(expected);
  });

  /*
   * Express hands back an array for a repeated query param and an object for a
   * bracketed one. Neither is a page size, and neither may become an unbounded
   * read - the parse is deliberately string-only so both land on the default.
   */
  it.each([
    ["an array", ["10", "20"]],
    ["an object", { size: 10 }],
    ["undefined", undefined],
    ["a number", 10],
  ])("falls back to the default for %s", (_label, raw) => {
    expect(clampPageSize(raw, BOUNDS)).toBe(20);
  });

  it("honours each surface's own bounds rather than a shared constant", () => {
    expect(clampPageSize("50", { defaultSize: 5, maxSize: 10 })).toBe(10);
    expect(clampPageSize("nonsense", { defaultSize: 5, maxSize: 10 })).toBe(5);
  });
});

describe("parseUuidCursor", () => {
  const uuid = "3f7c1a9e-2b4d-4c8e-9a1f-0d6b5e4c3a2b";

  it("returns the cursor when it is a uuid", () => {
    expect(parseUuidCursor(uuid)).toBe(uuid);
    expect(parseUuidCursor(uuid.toUpperCase())).toBe(uuid.toUpperCase());
  });

  /*
   * Three outcomes, not two. `undefined` is "none sent" and `null` is "sent and
   * malformed"; collapsing them makes a bad cursor silently return page one,
   * which is the same class of silent wrong answer as an untruncated page.
   */
  it("distinguishes an absent cursor from a malformed one", () => {
    expect(parseUuidCursor(undefined)).toBeUndefined();
    expect(parseUuidCursor("")).toBeUndefined();
    expect(parseUuidCursor(["a", "b"])).toBeUndefined();
    expect(parseUuidCursor("not-a-uuid")).toBeNull();
    expect(parseUuidCursor(`${uuid}extra`)).toBeNull();
  });
});

describe("splitPage", () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `row-${i + 1}` }));

  it("keeps the page and reports the row it held back", () => {
    expect(splitPage(rows(4), 3)).toEqual({
      items: [{ id: "row-1" }, { id: "row-2" }, { id: "row-3" }],
      nextCursor: "row-3",
      hasMore: true,
    });
  });

  it("reports the end of the data when the extra row is absent", () => {
    expect(splitPage(rows(3), 3)).toEqual({
      items: rows(3),
      nextCursor: null,
      hasMore: false,
    });
  });

  it("offers no cursor for an empty read", () => {
    expect(splitPage([], 3)).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  /*
   * The cursor is the last row of the PAGE, not of the read. Taking it from the
   * held-back row would skip that row on the next page.
   */
  it("takes the cursor from the last row of the page, not of the read", () => {
    expect(splitPage(rows(10), 2).nextCursor).toBe("row-2");
  });

  it("uses the supplied encoder rather than the row id when one is given", () => {
    expect(splitPage(rows(4), 3, (row) => `k:${row.id}`).nextCursor).toBe(
      "k:row-3",
    );
  });
});

describe("keyset cursors", () => {
  const CREATED_AT = new Date("2026-09-01T10:00:00.000Z");
  const ID = "3f7c1a9e-2b4d-4c8e-9a1f-0d6b5e4c3a2b";

  it("round-trips the whole sort key", () => {
    expect(
      parseKeysetCursor(encodeKeysetCursor({ createdAt: CREATED_AT, id: ID })),
    ).toEqual({ createdAt: CREATED_AT, id: ID });
  });

  /*
   * `createdAt` is TIMESTAMP(3) on every model paged this way, so the
   * millisecond is the whole precision of the column. A cursor that dropped it
   * would land on the wrong side of a tie.
   */
  it("preserves the millisecond", () => {
    const createdAt = new Date("2026-09-01T10:00:00.123Z");
    expect(
      parseKeysetCursor(encodeKeysetCursor({ createdAt, id: ID })),
    ).toEqual({ createdAt, id: ID });
  });

  it("is URL-safe, so a cursor survives a query string unescaped", () => {
    const encoded = encodeKeysetCursor({ createdAt: CREATED_AT, id: ID });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });

  it("does not hand the caller a readable id or timestamp to build on", () => {
    const encoded = encodeKeysetCursor({ createdAt: CREATED_AT, id: ID });
    expect(encoded).not.toContain(ID);
    expect(encoded).not.toContain(String(CREATED_AT.getTime()));
    expect(encoded).not.toContain(CREATED_AT.toISOString());
  });

  it("reports an absent cursor as undefined, not as malformed", () => {
    expect(parseKeysetCursor(undefined)).toBeUndefined();
    expect(parseKeysetCursor("")).toBeUndefined();
    expect(parseKeysetCursor(7)).toBeUndefined();
  });

  /*
   * base64url decoding does not throw on rubbish, it returns rubbish. Every
   * one of these decodes to something; the shape check is what rejects them,
   * which is why it is asserted case by case rather than through one example.
   */
  it.each([
    ["a bare row id, the pre-#2720 format", ID],
    ["no separator", Buffer.from(ID, "utf8").toString("base64url")],
    ["an empty timestamp", Buffer.from(`|${ID}`, "utf8").toString("base64url")],
    [
      "a non-numeric timestamp",
      Buffer.from(`when|${ID}`, "utf8").toString("base64url"),
    ],
    [
      "a timestamp too long to be milliseconds",
      Buffer.from(`1234567890123456|${ID}`, "utf8").toString("base64url"),
    ],
    [
      "an id that is not a uuid",
      Buffer.from("1756720800000|rx-7", "utf8").toString("base64url"),
    ],
    [
      "an empty id",
      Buffer.from("1756720800000|", "utf8").toString("base64url"),
    ],
    [
      "a third field bolted on the end",
      Buffer.from(`1756720800000|${ID}|extra`, "utf8").toString("base64url"),
    ],
  ])(
    "rejects %s as malformed rather than passing it to the query",
    (_label, raw) => {
      expect(parseKeysetCursor(raw)).toBeNull();
    },
  );
});
