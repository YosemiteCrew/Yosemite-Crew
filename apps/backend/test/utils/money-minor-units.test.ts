import {
  fromMinorUnits,
  getCurrencyExponent,
  toMinorUnits,
} from "@yosemite-crew/lib";

describe("getCurrencyExponent", () => {
  it("returns 2 for standard two-decimal currencies", () => {
    expect(getCurrencyExponent("USD")).toBe(2);
    expect(getCurrencyExponent("EUR")).toBe(2);
    expect(getCurrencyExponent("GBP")).toBe(2);
    expect(getCurrencyExponent("INR")).toBe(2);
  });

  it("returns 0 for zero-decimal currencies", () => {
    expect(getCurrencyExponent("JPY")).toBe(0);
    expect(getCurrencyExponent("KRW")).toBe(0);
    expect(getCurrencyExponent("VND")).toBe(0);
    expect(getCurrencyExponent("ISK")).toBe(0);
    expect(getCurrencyExponent("XOF")).toBe(0);
  });

  it("returns 3 for three-decimal currencies", () => {
    expect(getCurrencyExponent("BHD")).toBe(3);
    expect(getCurrencyExponent("KWD")).toBe(3);
    expect(getCurrencyExponent("OMR")).toBe(3);
    expect(getCurrencyExponent("TND")).toBe(3);
  });

  it("returns 4 for four-decimal currencies", () => {
    expect(getCurrencyExponent("CLF")).toBe(4);
    expect(getCurrencyExponent("UYW")).toBe(4);
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(getCurrencyExponent("jpy")).toBe(0);
    expect(getCurrencyExponent("bhd")).toBe(3);
    expect(getCurrencyExponent("  usd  ")).toBe(2);
  });

  it("defaults unknown but well-formed codes to 2", () => {
    expect(getCurrencyExponent("ZZZ")).toBe(2);
  });

  it("throws on malformed currency codes", () => {
    expect(() => getCurrencyExponent("")).toThrow(RangeError);
    expect(() => getCurrencyExponent("US")).toThrow(RangeError);
    expect(() => getCurrencyExponent("USDD")).toThrow(RangeError);
    expect(() => getCurrencyExponent("U1D")).toThrow(RangeError);
    expect(() => getCurrencyExponent(123 as unknown as string)).toThrow(
      RangeError,
    );
    expect(() => getCurrencyExponent(null as unknown as string)).toThrow(
      RangeError,
    );
  });
});

describe("toMinorUnits", () => {
  it("converts two-decimal amounts to cents", () => {
    expect(toMinorUnits(19.99, "USD")).toBe(1999);
    expect(toMinorUnits(10, "USD")).toBe(1000);
    expect(toMinorUnits(0, "USD")).toBe(0);
    expect(toMinorUnits(1234567.89, "USD")).toBe(123456789);
  });

  it("keeps zero-decimal currencies whole", () => {
    expect(toMinorUnits(1500, "JPY")).toBe(1500);
    expect(toMinorUnits(1500.4, "JPY")).toBe(1500);
    expect(toMinorUnits(1500.6, "JPY")).toBe(1501);
  });

  it("scales three-decimal currencies by 1000", () => {
    expect(toMinorUnits(1.234, "BHD")).toBe(1234);
    expect(toMinorUnits(1.2345, "BHD")).toBe(1235);
  });

  it("scales four-decimal currencies by 10000", () => {
    expect(toMinorUnits(1.2345, "CLF")).toBe(12345);
  });

  it("rounds half away from zero", () => {
    expect(toMinorUnits(19.995, "USD")).toBe(2000);
    expect(toMinorUnits(0.005, "USD")).toBe(1);
    expect(toMinorUnits(0.004, "USD")).toBe(0);
    expect(toMinorUnits(0.015, "USD")).toBe(2);
  });

  it("handles negative amounts symmetrically", () => {
    expect(toMinorUnits(-5.5, "USD")).toBe(-550);
    expect(toMinorUnits(-0.005, "USD")).toBe(-1);
  });

  it("does not accumulate binary floating-point error", () => {
    expect(toMinorUnits(1.1, "USD")).toBe(110);
    expect(toMinorUnits(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinorUnits(2.675, "USD")).toBe(268);
  });

  it("throws on non-finite amounts and invalid currencies", () => {
    expect(() => toMinorUnits(Number.NaN, "USD")).toThrow(RangeError);
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY, "USD")).toThrow(
      RangeError,
    );
    expect(() => toMinorUnits("5" as unknown as number, "USD")).toThrow(
      RangeError,
    );
    expect(() => toMinorUnits(5, "US")).toThrow(RangeError);
  });
});

describe("fromMinorUnits", () => {
  it("converts minor units back to major amounts", () => {
    expect(fromMinorUnits(1999, "USD")).toBe(19.99);
    expect(fromMinorUnits(1000, "USD")).toBe(10);
    expect(fromMinorUnits(0, "USD")).toBe(0);
  });

  it("respects the currency exponent", () => {
    expect(fromMinorUnits(1500, "JPY")).toBe(1500);
    expect(fromMinorUnits(1234, "BHD")).toBe(1.234);
    expect(fromMinorUnits(12345, "CLF")).toBe(1.2345);
  });

  it("handles negative minor units", () => {
    expect(fromMinorUnits(-550, "USD")).toBe(-5.5);
  });

  it("throws on non-integer minor amounts and invalid currencies", () => {
    expect(() => fromMinorUnits(19.99, "USD")).toThrow(RangeError);
    expect(() => fromMinorUnits(1.5, "USD")).toThrow(RangeError);
    expect(() => fromMinorUnits(100, "US")).toThrow(RangeError);
  });
});

describe("round trip", () => {
  it.each([
    [19.99, "USD"],
    [0, "USD"],
    [-5.5, "USD"],
    [1500, "JPY"],
    [1.234, "BHD"],
    [1.2345, "CLF"],
    [99.95, "EUR"],
  ])("preserves %p %s through to-and-from minor units", (amount, currency) => {
    expect(fromMinorUnits(toMinorUnits(amount, currency), currency)).toBe(
      amount,
    );
  });
});
