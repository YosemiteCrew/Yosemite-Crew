import { describe, expect, it } from "@jest/globals";
import {
  calculateDistanceMeters,
  filterWithinRadius,
  getBoundingDeltas,
  toRadians,
} from "../../src/utils/geo";

describe("geo utils", () => {
  it("converts degrees to radians", () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
  });

  it("returns zero distance for identical coordinates", () => {
    expect(calculateDistanceMeters(12.34, 56.78, 12.34, 56.78)).toBe(0);
  });

  it("calculates an approximate meter distance for longitude changes at the equator", () => {
    const distance = calculateDistanceMeters(0, 0, 0, 1);
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_500);
  });

  it("calculates bounding deltas for a radius", () => {
    expect(getBoundingDeltas(10, 111000)).toMatchObject({
      latDelta: 1,
    });
  });

  it("filters items outside the requested radius", () => {
    const items = filterWithinRadius(
      [
        {
          id: "org-1",
          address: {
            latitude: 0,
            longitude: 0,
          },
        },
        {
          id: "org-2",
          address: {
            latitude: 10,
            longitude: 10,
          },
        },
      ],
      0,
      0,
      1000,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("org-1");
  });
});
