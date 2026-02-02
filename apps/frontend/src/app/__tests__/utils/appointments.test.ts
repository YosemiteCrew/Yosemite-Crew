import { allowReschedule } from "@/app/lib/appointments";

describe("appointments utilities", () => {
  describe("allowReschedule", () => {
    it("returns true for REQUESTED status", () => {
      const result = allowReschedule("REQUESTED");
      expect(result).toBe(true);
    });

    it("returns true for UPCOMING status", () => {
      const result = allowReschedule("UPCOMING");
      expect(result).toBe(true);
    });

    it("returns false for COMPLETED status", () => {
      const result = allowReschedule("COMPLETED");
      expect(result).toBe(false);
    });

    it("returns false for CANCELLED status", () => {
      const result = allowReschedule("CANCELLED");
      expect(result).toBe(false);
    });

    it("returns false for NO_SHOW status", () => {
      const result = allowReschedule("NO_SHOW");
      expect(result).toBe(false);
    });

    it("returns false for IN_PROGRESS status", () => {
      const result = allowReschedule("IN_PROGRESS");
      expect(result).toBe(false);
    });

    it("returns false for unknown status", () => {
      const result = allowReschedule("UNKNOWN" as any);
      expect(result).toBe(false);
    });
  });
});
