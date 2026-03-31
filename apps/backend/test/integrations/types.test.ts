import { normalizeProvider } from "src/integrations/types";

describe("integration types", () => {
  it("normalizes integration provider values", () => {
    expect(normalizeProvider(undefined)).toBeNull();
    expect(normalizeProvider(" ")).toBeNull();
    expect(normalizeProvider("idexx")).toBe("IDEXX");
    expect(normalizeProvider("MERCK_MANUALS")).toBe("MERCK_MANUALS");
    expect(normalizeProvider("other")).toBeNull();
  });
});
