import { buildGeoPoint } from "src/utils/geojson";

describe("buildGeoPoint", () => {
  it("returns undefined when latitude is missing", () => {
    expect(
      buildGeoPoint({ latitude: undefined, longitude: 10 }),
    ).toBeUndefined();
  });

  it("returns undefined when longitude is missing", () => {
    expect(
      buildGeoPoint({ latitude: 10, longitude: undefined }),
    ).toBeUndefined();
  });

  it("builds a Point for non-zero coordinates", () => {
    expect(buildGeoPoint({ latitude: 19.0, longitude: 72.8 })).toEqual({
      type: "Point",
      coordinates: [72.8, 19.0],
    });
  });

  it("builds a Point for zero coordinates", () => {
    expect(buildGeoPoint({ latitude: 0, longitude: 0 })).toEqual({
      type: "Point",
      coordinates: [0, 0],
    });
  });
});
