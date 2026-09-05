import { toStripeMinorUnits } from "src/utils/stripe-minor-units";

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

  // KNOWN DRIFT, pinned as it behaves rather than as it should. 8.165 * 100 is
  // 816.4999999999999 in binary floating point, so the multiply-then-round loses
  // the cent that a decimal reading of 8.165 would keep. Deliberately NOT fixed
  // here: this promotion moves a function between files without changing what any
  // caller is charged, and correcting the drift changes money at all six call
  // sites, which deserves its own change and its own review. The value below is
  // the current answer, so a future fix will redden this test and be forced to
  // say so rather than sliding through.
  it("loses a cent on a half-cent float (known, unfixed)", () => {
    expect(toStripeMinorUnits(8.165, "usd")).toBe(816);
  });

  it("treats an unknown currency as two-decimal", () => {
    expect(toStripeMinorUnits(1, "zzz")).toBe(100);
  });
});
