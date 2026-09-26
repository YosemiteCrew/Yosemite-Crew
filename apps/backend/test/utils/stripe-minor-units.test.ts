import {
  UnsupportedStripeCurrencyError,
  fromStripeMinorUnits,
  isStripeChargeCurrencySupported,
  toStripeMinorUnits,
} from "src/utils/stripe-minor-units";

describe("toStripeMinorUnits", () => {
  it("scales a two-decimal currency by a hundred", () => {
    expect(toStripeMinorUnits(12.34, "usd")).toBe(1234);
  });

  it("submits a zero-decimal currency unscaled", () => {
    expect(toStripeMinorUnits(1000, "jpy")).toBe(1000);
  });

  // Stripe's Special cases override the zero-decimal rule for these two, so
  // they are scaled despite ISO 4217 calling them zero-decimal. Both are
  // pinned: UGX was in the set and overcharged by a hundred, ISK never was,
  // and one test per class is what let that asymmetry survive.
  it("scales UGX, which Stripe requires as a two-decimal value", () => {
    expect(toStripeMinorUnits(5, "ugx")).toBe(500);
  });

  it("scales ISK, which carries the identical special case", () => {
    expect(toStripeMinorUnits(5, "isk")).toBe(500);
  });

  it("matches the currency regardless of case or surrounding space", () => {
    expect(toStripeMinorUnits(1000, " JPY ")).toBe(1000);
  });

  it("always hands Stripe an integer", () => {
    expect(Number.isInteger(toStripeMinorUnits(0.1 + 0.2, "usd"))).toBe(true);
    expect(toStripeMinorUnits(0.1 + 0.2, "usd")).toBe(30);
  });

  // The same guarantee on the OTHER branch, which the test above does not
  // reach: it only exercises `usd`, so the rounding on the unscaled branch was
  // pinned by nothing and could be deleted with every test still green. Stripe
  // rejects a non-integer amount, and this branch is reachable with one --
  // `Service.cost` is a Float, so a 1000.5 JPY service is a real input.
  it("rounds a fractional zero-decimal amount rather than passing it through", () => {
    expect(toStripeMinorUnits(1000.5, "jpy")).toBe(1001);
    expect(Number.isInteger(toStripeMinorUnits(1000.5, "jpy"))).toBe(true);
  });

  it("rounds a half-cent amount to the exact minor unit", () => {
    expect(toStripeMinorUnits(8.165, "usd")).toBe(817);
  });

  it("uses the two-decimal scale for a currency not in the special-case sets", () => {
    expect(toStripeMinorUnits(1, "zzz")).toBe(100);
  });
});

describe("fromStripeMinorUnits", () => {
  it("converts a two-decimal Stripe amount to major units", () => {
    expect(fromStripeMinorUnits(1234, "usd")).toBe(12.34);
  });

  it("keeps a zero-decimal Stripe amount unscaled", () => {
    expect(fromStripeMinorUnits(1000, " JPY ")).toBe(1000);
  });
});

// A hundredth is not a three-decimal currency's minor unit, and scaling by a
// hundred drops the third digit: 1.234 KWD would reach Stripe as 123. Refused
// until a verified three-decimal conversion exists (#3153).
describe("three-decimal currencies", () => {
  it.each(["bhd", "jod", "kwd", "lyd", "omr", "tnd"])(
    "refuses to convert %s",
    (currency) => {
      expect(() => toStripeMinorUnits(1.234, currency)).toThrow(
        UnsupportedStripeCurrencyError,
      );
      expect(isStripeChargeCurrencySupported(currency)).toBe(false);
    },
  );

  it("matches the refusal regardless of case or surrounding space", () => {
    expect(() => toStripeMinorUnits(1.23, " KWD ")).toThrow(
      "Stripe charges are not supported in KWD",
    );
    expect(isStripeChargeCurrencySupported(" KWD ")).toBe(false);
  });

  it("still supports the two- and zero-decimal currencies", () => {
    expect(isStripeChargeCurrencySupported("usd")).toBe(true);
    expect(isStripeChargeCurrencySupported("jpy")).toBe(true);
  });
});
