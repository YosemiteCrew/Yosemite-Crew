import { allowDelete } from "@/app/lib/team";

describe("team utilities", () => {
  describe("allowDelete", () => {
    it("returns false for OWNER role", () => {
      const result = allowDelete("OWNER");
      expect(result).toBe(false);
    });

    it("returns true for ADMIN role", () => {
      const result = allowDelete("ADMIN");
      expect(result).toBe(true);
    });

    it("returns true for TECHNICIAN role", () => {
      const result = allowDelete("TECHNICIAN");
      expect(result).toBe(true);
    });

    it("returns true for any non-OWNER role", () => {
      expect(allowDelete("MANAGER" as any)).toBe(true);
      expect(allowDelete("STAFF" as any)).toBe(true);
      expect(allowDelete("" as any)).toBe(true);
    });
  });
});
