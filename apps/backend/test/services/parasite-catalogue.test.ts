import {
  resolveRegion,
  resolveRegionByCoordinate,
  resolveRegionFor,
} from "../../src/services/parasite-catalogue";

const BRISBANE = { lat: -27.375, lon: 153.125 };
const ROME = { lat: 41.875, lon: 12.375 };
/** Inside the coarse US envelope, and not a country we publish for. */
const MONTERREY = { lat: 25.625, lon: -100.375 };
/** Inside the coarse EU envelope, and not a country we publish for. */
const ANKARA = { lat: 39.875, lon: 32.875 };

describe("resolveRegionFor", () => {
  it("uses the coordinate when no country code is supplied", () => {
    expect(resolveRegionFor(null, BRISBANE.lat, BRISBANE.lon)).toBe("AU");
    expect(resolveRegionFor(undefined, ROME.lat, ROME.lon)).toBe("EU");
    expect(resolveRegionFor("   ", BRISBANE.lat, BRISBANE.lon)).toBe("AU");
    expect(resolveRegionFor(null, 0, -30)).toBeNull();
  });

  it("refuses an unsupported country rather than falling back to the envelope", () => {
    // The envelopes are coarse boxes that reach well past the countries they
    // cover, so falling back would serve a neighbour's catalogue here.
    expect(resolveRegionByCoordinate(MONTERREY.lat, MONTERREY.lon)).toBe("US");
    expect(resolveRegionFor("MX", MONTERREY.lat, MONTERREY.lon)).toBeNull();

    expect(resolveRegionByCoordinate(ANKARA.lat, ANKARA.lon)).toBe("EU");
    expect(resolveRegionFor("TR", ANKARA.lat, ANKARA.lon)).toBeNull();
  });

  it("refuses a country that contradicts the coordinate it arrived with", () => {
    // The cell this selects is shared with everyone else in the same square,
    // so caller-supplied text must not decide which catalogue they are shown.
    expect(resolveRegionFor("US", BRISBANE.lat, BRISBANE.lon)).toBeNull();
    expect(resolveRegionFor("AU", ROME.lat, ROME.lon)).toBeNull();
  });

  it("accepts a country that agrees with the coordinate", () => {
    expect(resolveRegionFor("AU", BRISBANE.lat, BRISBANE.lon)).toBe("AU");
    expect(resolveRegionFor("NZ", -41.375, 174.875)).toBe("AU");
    expect(resolveRegionFor("DE", ROME.lat, ROME.lon)).toBe("EU");
  });

  it("lets a supported country cover a coordinate the envelopes miss", () => {
    // Tenerife is Spanish and sits south of the European envelope.
    expect(resolveRegionByCoordinate(28.375, -16.625)).toBeNull();
    expect(resolveRegionFor("ES", 28.375, -16.625)).toBe("EU");
  });

  it("accepts a region code, which is what saved locations persist", () => {
    // A coordinate-only save stores the resolved region in its country column,
    // and the daily sweep reads that column back.
    expect(resolveRegion("EU")).toBe("EU");
    expect(resolveRegionFor("EU", ROME.lat, ROME.lon)).toBe("EU");
    expect(resolveRegionFor("AU", BRISBANE.lat, BRISBANE.lon)).toBe("AU");
    expect(resolveRegionFor("US", 40.125, -75.125)).toBe("US");
  });
});
