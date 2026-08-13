import type {
  ParasiteGroup,
  ParasiteId,
  RiskRegion,
} from "@yosemite-crew/types";

/**
 * Which parasites we model, where they plausibly occur, and the climate model
 * that drives each one.
 *
 * Range masks are deliberately coarse bounding boxes. They exist to stop us
 * reporting a paralysis tick risk in Western Australia or leishmaniasis in
 * Finland; they are not distribution maps and should not be presented as such.
 * Everything here is public reference knowledge, not a licensed data set.
 */

/** [minLat, maxLat, minLon, maxLon] */
export type RangeBox = readonly [number, number, number, number];

export type ParasiteModelSpec =
  /**
   * Accumulated degree days above a base temperature. Used for heartworm,
   * where development of L1 to infective L3 inside the mosquito requires a
   * known thermal budget before transmission is possible at all.
   */
  | {
      readonly kind: "DEGREE_DAY";
      readonly baseTempC: number;
      readonly windowDays: number;
      /** Degree-day total that maps to an index of 100. */
      readonly unitsForFullRisk: number;
      /** Degree-day total below which transmission cannot occur. */
      readonly transmissionThreshold: number;
    }
  /**
   * Tick questing. Ticks climb vegetation to seek a host only inside a
   * temperature window, and retreat to the leaf litter when the air is dry
   * enough to desiccate them, so saturation deficit is the limiting term.
   */
  | {
      readonly kind: "QUESTING";
      readonly tAbsMin: number;
      readonly tOptMin: number;
      readonly tOptMax: number;
      readonly tAbsMax: number;
      /** Saturation deficit (kPa) at which questing is fully suppressed. */
      readonly sdToleranceKpa: number;
      readonly windowDays: number;
      readonly precipWindowDays: number;
      readonly precipForFullMoistureMm: number;
    }
  /**
   * Off-host life-cycle development, used for fleas. Carries a floor because
   * an established indoor population keeps breeding through winter, so the
   * honest answer is never "no risk".
   */
  | {
      readonly kind: "DEVELOPMENT";
      readonly tAbsMin: number;
      readonly tOptMin: number;
      readonly tOptMax: number;
      readonly tAbsMax: number;
      readonly humidityMinPct: number;
      readonly humidityFullPct: number;
      readonly windowDays: number;
      readonly indoorFloor: number;
    }
  /** Simple thermal activity threshold, used for sandfly vectors. */
  | {
      readonly kind: "THERMAL_ACTIVITY";
      readonly tStart: number;
      readonly tFull: number;
      readonly windowDays: number;
    }
  /**
   * Warmth plus moisture, used where the limiting factor is a damp substrate:
   * gastropod intermediate hosts for lungworm, egg survival for the intestinal
   * worms.
   */
  | {
      readonly kind: "MOISTURE_THERMAL";
      readonly tAbsMin: number;
      readonly tOptMin: number;
      readonly tOptMax: number;
      readonly tAbsMax: number;
      readonly windowDays: number;
      readonly precipWindowDays: number;
      readonly precipForFullMoistureMm: number;
      readonly moistureWeight: number;
      readonly floor: number;
    };

export interface ParasiteDefinition {
  readonly id: ParasiteId;
  readonly group: ParasiteGroup;
  readonly regions: readonly RiskRegion[];
  /** Empty means the species is not range-limited within its regions. */
  readonly rangeBoxes: readonly RangeBox[];
  readonly model: ParasiteModelSpec;
}

const inBox = (lat: number, lon: number, box: RangeBox): boolean => {
  const [minLat, maxLat, minLon, maxLon] = box;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
};

export const PARASITE_CATALOGUE: readonly ParasiteDefinition[] = [
  {
    id: "heartworm",
    group: "VECTOR_BORNE",
    regions: ["AU", "US", "EU"],
    rangeBoxes: [],
    model: {
      kind: "DEGREE_DAY",
      // Development stalls below 14C; 130 heartworm development units are
      // needed for larvae to reach the infective stage.
      baseTempC: 14,
      windowDays: 30,
      transmissionThreshold: 130,
      unitsForFullRisk: 260,
    },
  },
  {
    id: "paralysis_tick",
    group: "TICK",
    regions: ["AU"],
    // Eastern seaboard band. The species is confined to a humid coastal strip.
    rangeBoxes: [[-44, -10, 141, 154]],
    model: {
      kind: "QUESTING",
      tAbsMin: 7,
      tOptMin: 13,
      tOptMax: 26,
      tAbsMax: 34,
      sdToleranceKpa: 0.9,
      windowDays: 14,
      precipWindowDays: 14,
      precipForFullMoistureMm: 40,
    },
  },
  {
    id: "brown_dog_tick",
    group: "TICK",
    regions: ["AU", "US", "EU"],
    rangeBoxes: [
      [-44, -10, 112, 154], // Australia, continent-wide
      [24, 40, -125, -66], // southern United States
      [34, 46, -10, 30], // Mediterranean Europe
    ],
    model: {
      kind: "QUESTING",
      // The one tick that tolerates dry heat, because it lives indoors and in
      // kennels rather than in leaf litter.
      tAbsMin: 10,
      tOptMin: 20,
      tOptMax: 32,
      tAbsMax: 40,
      sdToleranceKpa: 2.4,
      windowDays: 14,
      precipWindowDays: 14,
      precipForFullMoistureMm: 20,
    },
  },
  {
    id: "blacklegged_tick",
    group: "TICK",
    regions: ["US"],
    rangeBoxes: [
      [30, 50, -100, -66], // eastern and midwestern range
      [32, 49, -125, -115], // western range
    ],
    model: {
      kind: "QUESTING",
      tAbsMin: 4,
      tOptMin: 10,
      tOptMax: 24,
      tAbsMax: 32,
      sdToleranceKpa: 0.75,
      windowDays: 14,
      precipWindowDays: 14,
      precipForFullMoistureMm: 35,
    },
  },
  {
    id: "lone_star_tick",
    group: "TICK",
    regions: ["US"],
    rangeBoxes: [[28, 45, -100, -70]],
    model: {
      kind: "QUESTING",
      tAbsMin: 8,
      tOptMin: 16,
      tOptMax: 30,
      tAbsMax: 37,
      sdToleranceKpa: 1.2,
      windowDays: 14,
      precipWindowDays: 14,
      precipForFullMoistureMm: 35,
    },
  },
  {
    id: "american_dog_tick",
    group: "TICK",
    regions: ["US"],
    rangeBoxes: [[28, 50, -105, -66]],
    model: {
      kind: "QUESTING",
      tAbsMin: 6,
      tOptMin: 13,
      tOptMax: 27,
      tAbsMax: 35,
      sdToleranceKpa: 1.1,
      windowDays: 14,
      precipWindowDays: 14,
      precipForFullMoistureMm: 35,
    },
  },
  {
    id: "castor_bean_tick",
    group: "TICK",
    regions: ["EU"],
    rangeBoxes: [[36, 66, -11, 40]],
    model: {
      kind: "QUESTING",
      // Questing between roughly 7C and 25C, and highly desiccation sensitive.
      tAbsMin: 4,
      tOptMin: 8,
      tOptMax: 23,
      tAbsMax: 30,
      sdToleranceKpa: 0.7,
      windowDays: 14,
      precipWindowDays: 14,
      precipForFullMoistureMm: 30,
    },
  },
  {
    id: "ornate_dog_tick",
    group: "TICK",
    regions: ["EU"],
    rangeBoxes: [[42, 58, -6, 35]],
    model: {
      kind: "QUESTING",
      // Active earlier and later in the year than the castor bean tick, with
      // spring and autumn peaks.
      tAbsMin: 2,
      tOptMin: 6,
      tOptMax: 18,
      tAbsMax: 27,
      sdToleranceKpa: 0.85,
      windowDays: 14,
      precipWindowDays: 14,
      precipForFullMoistureMm: 30,
    },
  },
  {
    id: "flea",
    group: "FLEA",
    regions: ["AU", "US", "EU"],
    rangeBoxes: [],
    model: {
      kind: "DEVELOPMENT",
      tAbsMin: 8,
      tOptMin: 18,
      tOptMax: 32,
      tAbsMax: 35,
      humidityMinPct: 40,
      humidityFullPct: 75,
      windowDays: 21,
      // Heated homes sustain a population year round.
      indoorFloor: 0.22,
    },
  },
  {
    id: "sandfly_leishmania",
    group: "VECTOR_BORNE",
    regions: ["EU"],
    rangeBoxes: [[35, 47, -10, 30]],
    model: {
      kind: "THERMAL_ACTIVITY",
      tStart: 15,
      tFull: 25,
      windowDays: 14,
    },
  },
  {
    id: "lungworm",
    group: "WORM",
    regions: ["EU"],
    rangeBoxes: [[36, 62, -11, 30]],
    model: {
      kind: "MOISTURE_THERMAL",
      // Follows slug and snail activity: mild and wet.
      tAbsMin: 1,
      tOptMin: 8,
      tOptMax: 18,
      tAbsMax: 25,
      windowDays: 21,
      precipWindowDays: 21,
      precipForFullMoistureMm: 45,
      moistureWeight: 0.6,
      floor: 0.05,
    },
  },
  {
    id: "intestinal_worms",
    group: "WORM",
    regions: ["AU", "US", "EU"],
    rangeBoxes: [],
    model: {
      kind: "MOISTURE_THERMAL",
      // Egg embryonation in soil: needs warmth and damp, killed by hard frost
      // and by baking heat.
      tAbsMin: 4,
      tOptMin: 15,
      tOptMax: 30,
      tAbsMax: 38,
      windowDays: 21,
      precipWindowDays: 21,
      precipForFullMoistureMm: 40,
      moistureWeight: 0.5,
      // Environmental contamination persists regardless of current weather.
      floor: 0.15,
    },
  },
];

const EU_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "NO",
  "CH",
  "IS",
  "LI",
]);

const AU_COUNTRY_CODES = new Set(["AU", "NZ"]);
const US_COUNTRY_CODES = new Set(["US", "CA"]);

/**
 * A region code is a legitimate input here as well as a country code: a saved
 * location whose parent gave no country persists the resolved region in its
 * country column, and the daily sweep reads that column back.
 */
const REGION_CODES = new Map<string, RiskRegion>([
  ["AU", "AU"],
  ["US", "US"],
  ["EU", "EU"],
]);

/**
 * Map an ISO country code to the catalogue region.
 *
 * Returns null for countries we do not publish a catalogue for, so callers can
 * say "not available here" rather than silently showing another region's
 * parasites.
 */
export function resolveRegion(countryCode: string): RiskRegion | null {
  const code = countryCode.trim().toUpperCase();
  const region = REGION_CODES.get(code);
  if (region) return region;
  if (AU_COUNTRY_CODES.has(code)) return "AU";
  if (US_COUNTRY_CODES.has(code)) return "US";
  if (EU_COUNTRY_CODES.has(code)) return "EU";
  return null;
}

/**
 * Coarse region envelopes, used when we have a coordinate but no country code.
 *
 * The "use my current location" path has a position and no geocoder, and the
 * region is the only thing the catalogue actually needs, so inferring it
 * directly from the coordinate avoids pulling in a reverse-geocoding service
 * for a three-way decision.
 */
const REGION_ENVELOPES: readonly { region: RiskRegion; box: RangeBox }[] = [
  { region: "AU", box: [-48, -9, 110, 180] },
  { region: "US", box: [18, 72, -170, -52] },
  { region: "EU", box: [34, 72, -25, 45] },
];

export function resolveRegionByCoordinate(
  lat: number,
  lon: number,
): RiskRegion | null {
  return (
    REGION_ENVELOPES.find((envelope) => inBox(lat, lon, envelope.box))
      ?.region ?? null
  );
}

/**
 * Resolve the region for a cell from the country code when we have one, and
 * from the coordinate when we do not.
 *
 * A supplied country is never quietly discarded, in either direction:
 *
 * - a country we publish no catalogue for resolves to null rather than falling
 *   back to the envelopes, which are coarse boxes reaching well past the
 *   countries they cover. Turkey and northern Africa both sit inside the
 *   European box, so the fallback would hand them the EU catalogue as if it
 *   applied there;
 * - a supported country that contradicts the coordinate also resolves to null.
 *   The cell it would select is shared with every other user in the same
 *   square, so an unverified country code must not be able to decide which
 *   catalogue any of them are shown.
 */
export function resolveRegionFor(
  countryCode: string | null | undefined,
  lat: number,
  lon: number,
): RiskRegion | null {
  const fromCoordinate = resolveRegionByCoordinate(lat, lon);
  if (!countryCode?.trim()) return fromCoordinate;

  const fromCountry = resolveRegion(countryCode);
  if (fromCountry === null) return null;
  if (fromCoordinate !== null && fromCoordinate !== fromCountry) return null;

  return fromCountry;
}

/** The parasites that plausibly occur at a coordinate within a region. */
export function catalogueFor(
  region: RiskRegion,
  lat: number,
  lon: number,
): readonly ParasiteDefinition[] {
  return PARASITE_CATALOGUE.filter((definition) => {
    if (!definition.regions.includes(region)) return false;
    if (definition.rangeBoxes.length === 0) return true;
    return definition.rangeBoxes.some((box) => inBox(lat, lon, box));
  });
}
