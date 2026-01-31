import { formatMoney } from "@/app/utils/money";

describe("money utilities", () => {
  describe("formatMoney", () => {
    it("formats USD correctly", () => {
      const result = formatMoney(100, "USD");
      expect(result).toBe("$100");
    });

    it("formats EUR correctly", () => {
      const result = formatMoney(100, "EUR");
      expect(result).toBe("€100");
    });

    it("formats GBP correctly", () => {
      const result = formatMoney(100, "GBP");
      expect(result).toBe("£100");
    });

    it("formats JPY correctly", () => {
      const result = formatMoney(1000, "JPY");
      expect(result).toBe("¥1,000");
    });

    it("formats large numbers with commas", () => {
      const result = formatMoney(1000000, "USD");
      expect(result).toBe("$1,000,000");
    });

    it("rounds fractional amounts", () => {
      const result = formatMoney(99.99, "USD");
      expect(result).toBe("$100");
    });

    it("handles zero amount", () => {
      const result = formatMoney(0, "USD");
      expect(result).toBe("$0");
    });

    it("handles negative amounts", () => {
      const result = formatMoney(-50, "USD");
      expect(result).toBe("-$50");
    });

    it("formats INR correctly", () => {
      const result = formatMoney(1000, "INR");
      expect(result).toContain("1,000");
    });

    it("formats AUD correctly", () => {
      const result = formatMoney(250, "AUD");
      expect(result).toContain("250");
    });
  });
});
