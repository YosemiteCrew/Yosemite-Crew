import {
  AMBIGUOUS_LEDGER_CURRENCIES,
  DEFAULT_LEDGER_EXPONENT,
  LEDGER_CURRENCY_EXPONENTS,
  UnsupportedLedgerCurrencyError,
  fromLedgerMinorUnits,
  isLedgerCurrencySupported,
  quantizeMoney,
  resolveLedgerExponent,
  toLedgerMinorUnits,
} from "../../src/services/finance/currency";

describe("finance/currency", () => {
  describe("registry", () => {
    // The registry is derived from this runtime's ICU data, so the fixtures
    // below pin what that data must say. A build whose ICU disagrees changes
    // what every invoice is rounded to, and these are the amounts it changes.
    it.each([
      ["USD", 2],
      ["GBP", 2],
      ["EUR", 2],
      ["INR", 2],
      ["JPY", 0],
      ["KRW", 0],
      ["ISK", 0],
      ["KWD", 3],
      ["BHD", 3],
      ["OMR", 3],
    ])("posts %s at %i decimals", (code, exponent) => {
      expect(resolveLedgerExponent(code)).toBe(exponent);
    });

    it("covers every ICU currency except the ones it names", () => {
      // The size is checked against ICU's own list, not against a count
      // recomputed from the registry, which could only agree with itself.
      // The suite above would pass on a registry missing every currency it
      // does not name, because those lookups are never made.
      const icuCodes = Intl.supportedValuesOf("currency");
      expect(AMBIGUOUS_LEDGER_CURRENCIES.size).toBe(17);
      for (const code of AMBIGUOUS_LEDGER_CURRENCIES) {
        // An excluded code that ICU does not know excludes nothing.
        expect(icuCodes).toContain(code);
        expect(LEDGER_CURRENCY_EXPONENTS.has(code)).toBe(false);
      }
      expect(LEDGER_CURRENCY_EXPONENTS.size).toBe(
        icuCodes.length - AMBIGUOUS_LEDGER_CURRENCIES.size,
      );
    });

    it("refuses a code whose display digits and minor unit disagree", () => {
      // ICU reports 0 fraction digits for these; ISO 4217 assigns 2 (3 for
      // IQD). Neither number can be posted without deciding which authority
      // the ledger follows, so the registry declines to price them.
      for (const code of ["HUF", "COP", "IDR", "PKR", "IQD"]) {
        expect(Intl.supportedValuesOf("currency")).toContain(code);
        expect(isLedgerCurrencySupported(code)).toBe(false);
        expect(() => resolveLedgerExponent(code)).toThrow(
          UnsupportedLedgerCurrencyError,
        );
      }
    });

    it("rejects an unknown code instead of falling back to two decimals", () => {
      // ZZZ is well formed, so Intl.NumberFormat accepts it and formats with
      // the generic two-digit fallback. Membership must not come from that.
      expect(
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "ZZZ",
        }).resolvedOptions().maximumFractionDigits,
      ).toBe(2);
      expect(() => resolveLedgerExponent("ZZZ")).toThrow(
        UnsupportedLedgerCurrencyError,
      );
    });

    it("normalises case and surrounding space", () => {
      expect(resolveLedgerExponent(" jpy ")).toBe(0);
      expect(isLedgerCurrencySupported("kwd")).toBe(true);
    });

    it("keeps the legacy precision when no currency is supplied", () => {
      expect(resolveLedgerExponent(undefined)).toBe(DEFAULT_LEDGER_EXPONENT);
      expect(resolveLedgerExponent(null)).toBe(DEFAULT_LEDGER_EXPONENT);
      expect(resolveLedgerExponent("  ")).toBe(DEFAULT_LEDGER_EXPONENT);
      expect(isLedgerCurrencySupported(null)).toBe(false);
    });
  });

  describe("quantizeMoney", () => {
    it("rounds a tie away from zero at each supported precision", () => {
      expect(quantizeMoney(10.005, 2)).toBe(10.01);
      expect(quantizeMoney(-10.005, 2)).toBe(-10.01);
      expect(quantizeMoney(2.675, 2)).toBe(2.68);
      expect(quantizeMoney(0.5, 0)).toBe(1);
      expect(quantizeMoney(1.5, 0)).toBe(2);
      expect(quantizeMoney(1.0005, 3)).toBe(1.001);
    });

    it("rounds the decimal a person typed, not its binary expansion", () => {
      // 2.675 is stored as 2.67499999999999982…, so reading the expansion
      // rounds it down. The shortest round-tripping decimal is the amount.
      expect((2.675).toFixed(20)).toBe("2.67499999999999982236");
      expect(quantizeMoney(2.675, 2)).toBe(2.68);
    });

    it("leaves an amount already at its precision alone", () => {
      expect(quantizeMoney(0.1 + 0.2, 2)).toBe(0.3);
      expect(quantizeMoney(1234, 0)).toBe(1234);
      expect(quantizeMoney(1.234, 3)).toBe(1.234);
    });

    it("rejects a non-finite amount", () => {
      expect(() => quantizeMoney(Number.NaN, 2)).toThrow(RangeError);
      expect(() => quantizeMoney(Number.POSITIVE_INFINITY, 2)).toThrow(
        RangeError,
      );
    });

    it("rejects an amount beyond exact integer range", () => {
      expect(() => quantizeMoney(1e17, 2)).toThrow(RangeError);
    });
  });

  describe("minor units", () => {
    it("converts at the currency's own scale", () => {
      expect(toLedgerMinorUnits(12.34, 2)).toBe(1234);
      expect(toLedgerMinorUnits(1234, 0)).toBe(1234);
      expect(toLedgerMinorUnits(1.234, 3)).toBe(1234);
      expect(toLedgerMinorUnits(-12.34, 2)).toBe(-1234);
    });

    it("is exact where scaling the float is not", () => {
      // 1.005 * 100 is 100.49999999999999 in binary, so Math.round of it is
      // 100 rather than 101.
      expect(Math.round(1.005 * 100)).toBe(100);
      expect(toLedgerMinorUnits(1.005, 2)).toBe(101);
    });

    it("handles an exponential literal", () => {
      expect(toLedgerMinorUnits(1e-7, 2)).toBe(0);
      expect(toLedgerMinorUnits(1.5e3, 2)).toBe(150000);
    });

    it("round-trips back to the major unit", () => {
      expect(fromLedgerMinorUnits(toLedgerMinorUnits(257.83, 2), 2)).toBe(
        257.83,
      );
      expect(fromLedgerMinorUnits(toLedgerMinorUnits(1234, 0), 0)).toBe(1234);
    });
  });
});
