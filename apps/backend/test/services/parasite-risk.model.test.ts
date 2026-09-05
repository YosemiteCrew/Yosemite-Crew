import {
  computeCellReadings,
  saturationDeficitKpa,
  saturationVapourPressureKpa,
  tierForIndex,
  trapezoid,
  trendFor,
  type DailyWeather,
} from "../../src/services/parasite-risk.model";
import {
  catalogueFor,
  resolveRegion,
  resolveRegionByCoordinate,
  resolveRegionFor,
} from "../../src/services/parasite-catalogue";
import { snapToRiskCell } from "@yosemite-crew/types";

/**
 * Build a run of identical days. The models all read trailing windows, so a
 * flat series is the cleanest way to pin down their response to one input.
 */
const days = (
  count: number,
  overrides: Partial<DailyWeather> = {},
): DailyWeather[] =>
  Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    tMean: 20,
    tMax: 25,
    tMin: 15,
    precipitationMm: 2,
    humidityPct: 80,
    dewPointC: 16,
    ...overrides,
  }));

const readingFor = (
  result: ReturnType<typeof computeCellReadings>,
  parasiteId: string,
) => result.readings.find((r) => r.parasiteId === parasiteId);

// Brisbane: inside the paralysis tick range.
const BRISBANE = { lat: -27.47, lon: 153.03 };
// Perth: Australia, but outside the paralysis tick range.
const PERTH = { lat: -31.95, lon: 115.86 };
// Rome: inside the sandfly range.
const ROME = { lat: 41.9, lon: 12.5 };
// Stockholm: Europe, north of the sandfly range.
const STOCKHOLM = { lat: 59.33, lon: 18.06 };

describe("trapezoid", () => {
  it("is zero outside the absolute limits", () => {
    expect(trapezoid(0, 5, 10, 20, 30)).toBe(0);
    expect(trapezoid(35, 5, 10, 20, 30)).toBe(0);
  });

  it("is one across the optimum", () => {
    expect(trapezoid(10, 5, 10, 20, 30)).toBe(1);
    expect(trapezoid(15, 5, 10, 20, 30)).toBe(1);
    expect(trapezoid(20, 5, 10, 20, 30)).toBe(1);
  });

  it("ramps linearly on both shoulders", () => {
    expect(trapezoid(7.5, 5, 10, 20, 30)).toBeCloseTo(0.5);
    expect(trapezoid(25, 5, 10, 20, 30)).toBeCloseTo(0.5);
  });

  it("stays finite when a shoulder has no width", () => {
    // A spec whose absolute and optimum bounds coincide has no shoulder to
    // interpolate across, and must not divide by zero.
    expect(trapezoid(20, 10, 10, 30, 30)).toBe(1);
    expect(trapezoid(10, 10, 10, 30, 30)).toBe(0);
    expect(trapezoid(30, 10, 10, 30, 30)).toBe(0);
  });
});

describe("saturation deficit", () => {
  it("is zero at full saturation", () => {
    const [day] = days(1, { humidityPct: 100 });
    expect(saturationDeficitKpa(day)).toBeCloseTo(0);
  });

  it("grows as air dries out", () => {
    const [humid] = days(1, { humidityPct: 90 });
    const [dry] = days(1, { humidityPct: 30 });
    expect(saturationDeficitKpa(dry)!).toBeGreaterThan(
      saturationDeficitKpa(humid)!,
    );
  });

  it("falls back to dew point when humidity is missing", () => {
    const [day] = days(1, { humidityPct: null, dewPointC: 10 });
    const expected =
      saturationVapourPressureKpa(20) - saturationVapourPressureKpa(10);
    expect(saturationDeficitKpa(day)).toBeCloseTo(expected);
  });

  it("returns null when neither humidity nor dew point is available", () => {
    const [day] = days(1, { humidityPct: null, dewPointC: null });
    expect(saturationDeficitKpa(day)).toBeNull();
  });
});

describe("tierForIndex", () => {
  it.each([
    [0, "LOW"],
    [24, "LOW"],
    [25, "MODERATE"],
    [49, "MODERATE"],
    [50, "HIGH"],
    [74, "HIGH"],
    [75, "EXTREME"],
    [100, "EXTREME"],
  ])("maps %i to %s", (index, tier) => {
    expect(tierForIndex(index)).toBe(tier);
  });
});

describe("heartworm degree-day model", () => {
  it("reports no transmission risk below the 130 HDU threshold", () => {
    // 30 days at 16C = 2 degrees above base = 60 HDU, well short of 130.
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(30, { tMean: 16 }),
      [],
    );

    const heartworm = readingFor(result, "heartworm");
    expect(heartworm!.tier).toBe("LOW");
    expect(heartworm!.index).toBe(0);
  });

  it("crosses into high risk once the thermal budget is met", () => {
    // 30 days at 27C = 13 above base = 390 HDU, past the 260 full-risk point.
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(30, { tMean: 27 }),
      [],
    );

    const heartworm = readingFor(result, "heartworm");
    expect(heartworm!.index).toBe(100);
    expect(heartworm!.tier).toBe("EXTREME");
  });

  it("is a step change either side of the threshold, not a smooth ramp", () => {
    // The life cycle either completes or it does not, so the index must not
    // creep up while the thermal budget is still short.
    const below = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      // 30 days at 18C = 4 above base = 120 HDU, just short of 130.
      days(30, { tMean: 18 }),
      [],
    );
    const above = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      // 30 days at 19C = 150 HDU, just past it.
      days(30, { tMean: 19 }),
      [],
    );

    expect(readingFor(below, "heartworm")!.index).toBe(0);
    expect(readingFor(above, "heartworm")!.index).toBeGreaterThan(0);
  });
});

describe("sandfly thermal activity model", () => {
  it("is silent below the activity threshold and rises with warmth", () => {
    const cold = computeCellReadings(
      "EU",
      ROME.lat,
      ROME.lon,
      days(14, { tMean: 12 }),
      [],
    );
    const warm = computeCellReadings(
      "EU",
      ROME.lat,
      ROME.lon,
      days(14, { tMean: 20 }),
      [],
    );
    const hot = computeCellReadings(
      "EU",
      ROME.lat,
      ROME.lon,
      days(14, { tMean: 26 }),
      [],
    );

    expect(readingFor(cold, "sandfly_leishmania")!.index).toBe(0);
    // 20C sits halfway between the 15C start and the 25C full-activity point.
    expect(readingFor(warm, "sandfly_leishmania")!.index).toBe(50);
    expect(readingFor(hot, "sandfly_leishmania")!.index).toBe(100);
  });
});

describe("tick questing model", () => {
  it("suppresses questing when the air is too dry", () => {
    const humid = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(14, { tMean: 20, humidityPct: 95 }),
      [],
    );
    const arid = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(14, { tMean: 20, humidityPct: 20 }),
      [],
    );

    expect(readingFor(arid, "paralysis_tick")!.index).toBeLessThan(
      readingFor(humid, "paralysis_tick")!.index,
    );
  });

  it("reports no activity when it is too cold to quest", () => {
    const result = computeCellReadings(
      "EU",
      STOCKHOLM.lat,
      STOCKHOLM.lon,
      days(14, { tMean: -5, humidityPct: 90 }),
      [],
    );

    expect(readingFor(result, "castor_bean_tick")!.index).toBe(0);
  });

  it("penalises warming at constant relative humidity, because saturation deficit rises", () => {
    // Worth pinning down because it is counter-intuitive: the same 85% RH is a
    // much larger absolute moisture deficit at 24C than at 12C, and questing
    // ticks are limited by desiccation rather than by warmth alone.
    const cool = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(14, { tMean: 12, humidityPct: 85 }),
      [],
    );
    const warm = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(14, { tMean: 24, humidityPct: 85 }),
      [],
    );

    expect(readingFor(warm, "paralysis_tick")!.index).toBeLessThan(
      readingFor(cool, "paralysis_tick")!.index,
    );
  });

  it("falls back to a neutral humidity term and flags the reading as degraded", () => {
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(14, { humidityPct: null, dewPointC: null }),
      [],
    );

    expect(result.degraded).toBe(true);
  });

  it("flags a reading when only forecast weather is degraded", () => {
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(14),
      days(7, { humidityPct: null, dewPointC: null }),
    );

    expect(result.degraded).toBe(true);
  });
});

describe("risk cell snapping", () => {
  it("keeps maximum boundary coordinates inside valid ranges", () => {
    expect(snapToRiskCell(90, 180)).toEqual({ lat: 89.875, lon: 179.875 });
    expect(snapToRiskCell(-90, -180)).toEqual({ lat: -89.875, lon: -179.875 });
  });
});

describe("flea development model", () => {
  it("never reports zero, because the indoor population persists", () => {
    const result = computeCellReadings(
      "EU",
      STOCKHOLM.lat,
      STOCKHOLM.lon,
      days(21, { tMean: -12, humidityPct: 60 }),
      [],
    );

    const flea = readingFor(result, "flea");
    // The indoor floor is 0.22, so the index floors at 22.
    expect(flea!.index).toBe(22);
  });

  it("rises well above the floor in warm humid conditions", () => {
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(21, { tMean: 25, humidityPct: 85 }),
      [],
    );

    expect(readingFor(result, "flea")!.index).toBeGreaterThan(80);
  });
});

describe("trend", () => {
  it("treats exact five-point movements as trends", () => {
    expect(trendFor(50, 55)).toBe("RISING");
    expect(trendFor(50, 45)).toBe("FALLING");
  });

  it("reports rising when the forecast lifts conditions into the questing window", () => {
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      // 4C is below the questing threshold entirely; 18C is inside the optimum.
      days(14, { tMean: 4, humidityPct: 85 }),
      days(7, { tMean: 18, humidityPct: 85 }),
    );

    expect(readingFor(result, "paralysis_tick")!.trend).toBe("RISING");
  });

  it("reports falling when the forecast dries the air out", () => {
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(14, { tMean: 20, humidityPct: 90 }),
      days(7, { tMean: 20, humidityPct: 35 }),
    );

    expect(readingFor(result, "paralysis_tick")!.trend).toBe("FALLING");
  });

  it("reports steady when the forecast matches the recent past", () => {
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(14, { tMean: 20, humidityPct: 85 }),
      days(7, { tMean: 20, humidityPct: 85 }),
    );

    expect(readingFor(result, "paralysis_tick")!.trend).toBe("STEADY");
  });
});

describe("regional catalogues", () => {
  it("includes the paralysis tick on the Australian east coast only", () => {
    const brisbane = catalogueFor("AU", BRISBANE.lat, BRISBANE.lon).map(
      (d) => d.id,
    );
    const perth = catalogueFor("AU", PERTH.lat, PERTH.lon).map((d) => d.id);

    expect(brisbane).toContain("paralysis_tick");
    expect(perth).not.toContain("paralysis_tick");
  });

  it("includes sandflies around the Mediterranean but not in Scandinavia", () => {
    const rome = catalogueFor("EU", ROME.lat, ROME.lon).map((d) => d.id);
    const stockholm = catalogueFor("EU", STOCKHOLM.lat, STOCKHOLM.lon).map(
      (d) => d.id,
    );

    expect(rome).toContain("sandfly_leishmania");
    expect(stockholm).not.toContain("sandfly_leishmania");
  });

  it("keeps each region's ticks out of the other regions", () => {
    const au = catalogueFor("AU", BRISBANE.lat, BRISBANE.lon).map((d) => d.id);
    const eu = catalogueFor("EU", ROME.lat, ROME.lon).map((d) => d.id);
    const us = catalogueFor("US", 40, -75).map((d) => d.id);

    expect(au).not.toContain("blacklegged_tick");
    expect(eu).not.toContain("lone_star_tick");
    expect(us).not.toContain("castor_bean_tick");
  });

  it("models heartworm everywhere", () => {
    for (const [region, coords] of [
      ["AU", BRISBANE],
      ["EU", ROME],
      ["US", { lat: 30, lon: -90 }],
    ] as const) {
      expect(
        catalogueFor(region, coords.lat, coords.lon).map((d) => d.id),
      ).toContain("heartworm");
    }
  });

  it("sorts readings most severe first so the headline is readings[0]", () => {
    const result = computeCellReadings(
      "AU",
      BRISBANE.lat,
      BRISBANE.lon,
      days(30, { tMean: 26, humidityPct: 88 }),
      [],
    );

    const indices = result.readings.map((r) => r.index);
    expect([...indices].sort((a, b) => b - a)).toEqual(indices);
    expect(result.overallTier).toBe(result.readings[0].tier);
  });
});

describe("region resolution", () => {
  it("maps country codes to regions", () => {
    expect(resolveRegion("au")).toBe("AU");
    expect(resolveRegion("US")).toBe("US");
    expect(resolveRegion("de")).toBe("EU");
    expect(resolveRegion("BR")).toBeNull();
  });

  it("falls back to the coordinate when no country code is supplied", () => {
    expect(resolveRegionByCoordinate(BRISBANE.lat, BRISBANE.lon)).toBe("AU");
    expect(resolveRegionByCoordinate(ROME.lat, ROME.lon)).toBe("EU");
    expect(resolveRegionByCoordinate(40, -75)).toBe("US");
  });

  it("prefers the country code over the coordinate envelope", () => {
    // Country code wins even though the coordinate is inside another envelope.
    expect(resolveRegionFor("DE", ROME.lat, ROME.lon)).toBe("EU");
    expect(resolveRegionFor(null, BRISBANE.lat, BRISBANE.lon)).toBe("AU");
    expect(resolveRegionFor("BR", 0, 0)).toBeNull();
  });
});
