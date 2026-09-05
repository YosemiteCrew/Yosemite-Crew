import {
  clampPageSize,
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
});
