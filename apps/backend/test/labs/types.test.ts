import { normalizeLabProvider } from "src/labs/types";

describe("lab types", () => {
  it("normalizes lab provider values", () => {
    expect(normalizeLabProvider(undefined)).toBeNull();
    expect(normalizeLabProvider(" ")).toBeNull();
    expect(normalizeLabProvider("idexx")).toBe("IDEXX");
    expect(normalizeLabProvider("other")).toBeNull();
  });
});
