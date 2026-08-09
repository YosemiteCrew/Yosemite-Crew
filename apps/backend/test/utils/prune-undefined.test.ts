import { describe, expect, it } from "@jest/globals";
import { pruneUndefined } from "../../src/utils/prune-undefined";

describe("pruneUndefined", () => {
  it("removes undefined entries from arrays recursively", () => {
    expect(pruneUndefined([1, undefined, "a", [undefined, 2]])).toEqual([
      1,
      "a",
      [2],
    ]);
  });

  it("removes undefined properties from nested objects", () => {
    expect(
      pruneUndefined({
        keep: "value",
        drop: undefined,
        nested: { keep: 0, drop: undefined },
      }),
    ).toEqual({ keep: "value", nested: { keep: 0 } });
  });

  it("preserves Date instances", () => {
    const date = new Date("2026-01-01");
    expect(pruneUndefined({ date }).date).toBe(date);
    expect(pruneUndefined(date)).toBe(date);
  });

  it("keeps null values and returns primitives unchanged", () => {
    expect(pruneUndefined({ value: null })).toEqual({ value: null });
    expect(pruneUndefined(null)).toBeNull();
    expect(pruneUndefined("text")).toBe("text");
    expect(pruneUndefined(0)).toBe(0);
    expect(pruneUndefined(undefined)).toBeUndefined();
  });
});
