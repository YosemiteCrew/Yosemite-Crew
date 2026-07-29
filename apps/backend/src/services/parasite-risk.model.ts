import type {
  ParasiteRiskReading,
  RiskRegion,
  RiskTier,
  RiskTrend,
} from "@yosemite-crew/types";
import {
  catalogueFor,
  type ParasiteDefinition,
  type ParasiteModelSpec,
} from "./parasite-catalogue";

/**
 * Climate-driven parasite risk models.
 *
 * Every function here is pure and deterministic: same weather in, same index
 * out. Nothing in this file performs IO, so the models can be tested against
 * fixture weather series.
 *
 * The output is a modelled index, not an observed case rate. It answers "are
 * conditions right for this parasite to be active here", which is the question
 * that decides whether preventative cover matters this month.
 */

/** Bump when a model changes so stored readings stay explainable. */
export const MODEL_VERSION = "2026.07-1";

export interface DailyWeather {
  date: string;
  tMean: number;
  tMax: number;
  tMin: number;
  precipitationMm: number;
  humidityPct: number | null;
  dewPointC: number | null;
}

const TIER_BREAKPOINTS: readonly { max: number; tier: RiskTier }[] = [
  { max: 25, tier: "LOW" },
  { max: 50, tier: "MODERATE" },
  { max: 75, tier: "HIGH" },
  { max: Number.POSITIVE_INFINITY, tier: "EXTREME" },
];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;

/**
 * Saturation vapour pressure in kPa (Magnus formula).
 *
 * Used to turn relative humidity into saturation deficit, which is what
 * actually governs whether a tick can stay out questing without drying out.
 */
export function saturationVapourPressureKpa(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

/**
 * Saturation deficit in kPa, or null when neither humidity nor dew point is
 * available. Null makes the caller fall back to a neutral term and flag the
 * reading as degraded rather than inventing a number.
 */
export function saturationDeficitKpa(day: DailyWeather): number | null {
  const svp = saturationVapourPressureKpa(day.tMean);

  if (day.humidityPct !== null) {
    return Math.max(0, svp * (1 - clamp(day.humidityPct, 0, 100) / 100));
  }

  if (day.dewPointC !== null) {
    return Math.max(0, svp - saturationVapourPressureKpa(day.dewPointC));
  }

  return null;
}

/**
 * Trapezoidal suitability curve: zero outside the absolute limits, one across
 * the optimum, linear on the shoulders. This is the standard shape for an
 * ectotherm's activity response to temperature.
 */
export function trapezoid(
  value: number,
  absMin: number,
  optMin: number,
  optMax: number,
  absMax: number,
): number {
  if (value <= absMin || value >= absMax) return 0;
  if (value >= optMin && value <= optMax) return 1;
  if (value < optMin) return (value - absMin) / (optMin - absMin);
  return (absMax - value) / (absMax - optMax);
}

const trailing = <T>(series: readonly T[], count: number): readonly T[] =>
  count >= series.length ? series : series.slice(series.length - count);

const rollingPrecipitation = (
  series: readonly DailyWeather[],
  windowDays: number,
): number =>
  trailing(series, windowDays).reduce(
    (total, day) => total + Math.max(0, day.precipitationMm),
    0,
  );

interface ModelOutcome {
  /** 0-100. */
  index: number;
  /** True when a humidity input was missing and a neutral term was used. */
  degraded: boolean;
}

function degreeDayIndex(
  spec: Extract<ParasiteModelSpec, { kind: "DEGREE_DAY" }>,
  series: readonly DailyWeather[],
): ModelOutcome {
  const window = trailing(series, spec.windowDays);
  const units = window.reduce(
    (total, day) => total + Math.max(0, day.tMean - spec.baseTempC),
    0,
  );

  // Below the transmission threshold the life cycle cannot complete, so the
  // honest index is zero rather than a small positive number.
  if (units < spec.transmissionThreshold) {
    const approach = units / spec.transmissionThreshold;
    return { index: Math.round(clamp(approach, 0, 1) * 24), degraded: false };
  }

  const ratio = units / spec.unitsForFullRisk;
  return { index: Math.round(clamp(ratio, 0, 1) * 100), degraded: false };
}

function questingIndex(
  spec: Extract<ParasiteModelSpec, { kind: "QUESTING" }>,
  series: readonly DailyWeather[],
): ModelOutcome {
  const window = trailing(series, spec.windowDays);
  let missingHumidity = false;

  const dayScores = window.map((day) => {
    const temperature = trapezoid(
      day.tMean,
      spec.tAbsMin,
      spec.tOptMin,
      spec.tOptMax,
      spec.tAbsMax,
    );

    const deficit = saturationDeficitKpa(day);
    if (deficit === null) {
      missingHumidity = true;
      return temperature * 0.75;
    }

    const humidity = clamp(1 - deficit / spec.sdToleranceKpa, 0, 1);
    // Temperature gates activity outright; humidity modulates how much of the
    // population is willing to sit up on the vegetation.
    return temperature * (0.35 + 0.65 * humidity);
  });

  const precipitation = rollingPrecipitation(series, spec.precipWindowDays);
  const moisture = clamp(
    0.7 + 0.3 * (precipitation / spec.precipForFullMoistureMm),
    0.7,
    1,
  );

  return {
    index: Math.round(clamp(mean(dayScores) * moisture, 0, 1) * 100),
    degraded: missingHumidity,
  };
}

function developmentIndex(
  spec: Extract<ParasiteModelSpec, { kind: "DEVELOPMENT" }>,
  series: readonly DailyWeather[],
): ModelOutcome {
  const window = trailing(series, spec.windowDays);
  let missingHumidity = false;

  const dayScores = window.map((day) => {
    const temperature = trapezoid(
      day.tMean,
      spec.tAbsMin,
      spec.tOptMin,
      spec.tOptMax,
      spec.tAbsMax,
    );

    if (day.humidityPct === null) {
      missingHumidity = true;
      return temperature * 0.75;
    }

    const humidity = clamp(
      (day.humidityPct - spec.humidityMinPct) /
        (spec.humidityFullPct - spec.humidityMinPct),
      0,
      1,
    );

    return temperature * (0.4 + 0.6 * humidity);
  });

  const outdoor = mean(dayScores);
  return {
    index: Math.round(Math.max(outdoor, spec.indoorFloor) * 100),
    degraded: missingHumidity,
  };
}

function thermalActivityIndex(
  spec: Extract<ParasiteModelSpec, { kind: "THERMAL_ACTIVITY" }>,
  series: readonly DailyWeather[],
): ModelOutcome {
  const window = trailing(series, spec.windowDays);
  const dayScores = window.map((day) =>
    clamp((day.tMean - spec.tStart) / (spec.tFull - spec.tStart), 0, 1),
  );

  return { index: Math.round(mean(dayScores) * 100), degraded: false };
}

function moistureThermalIndex(
  spec: Extract<ParasiteModelSpec, { kind: "MOISTURE_THERMAL" }>,
  series: readonly DailyWeather[],
): ModelOutcome {
  const window = trailing(series, spec.windowDays);
  const temperature = mean(
    window.map((day) =>
      trapezoid(
        day.tMean,
        spec.tAbsMin,
        spec.tOptMin,
        spec.tOptMax,
        spec.tAbsMax,
      ),
    ),
  );

  const precipitation = rollingPrecipitation(series, spec.precipWindowDays);
  const moisture = clamp(precipitation / spec.precipForFullMoistureMm, 0, 1);
  const combined =
    temperature * (1 - spec.moistureWeight + spec.moistureWeight * moisture);

  return {
    index: Math.round(Math.max(combined, spec.floor) * 100),
    degraded: false,
  };
}

function runModel(
  spec: ParasiteModelSpec,
  series: readonly DailyWeather[],
): ModelOutcome {
  switch (spec.kind) {
    case "DEGREE_DAY":
      return degreeDayIndex(spec, series);
    case "QUESTING":
      return questingIndex(spec, series);
    case "DEVELOPMENT":
      return developmentIndex(spec, series);
    case "THERMAL_ACTIVITY":
      return thermalActivityIndex(spec, series);
    case "MOISTURE_THERMAL":
      return moistureThermalIndex(spec, series);
  }
}

export function tierForIndex(index: number): RiskTier {
  const bounded = clamp(index, 0, 100);
  return (
    TIER_BREAKPOINTS.find((breakpoint) => bounded < breakpoint.max)?.tier ??
    "EXTREME"
  );
}

/** Five points of index movement is the smallest change worth calling a trend. */
const TREND_SENSITIVITY = 5;

function trendFor(current: number, projected: number): RiskTrend {
  const delta = projected - current;
  if (delta > TREND_SENSITIVITY) return "RISING";
  if (delta < -TREND_SENSITIVITY) return "FALLING";
  return "STEADY";
}

function readingFor(
  definition: ParasiteDefinition,
  past: readonly DailyWeather[],
  full: readonly DailyWeather[],
): { reading: ParasiteRiskReading; degraded: boolean } {
  const current = runModel(definition.model, past);
  // Re-run the same window shifted onto the forecast to get direction of travel.
  const projected = runModel(definition.model, full);

  return {
    degraded: current.degraded,
    reading: {
      parasiteId: definition.id,
      group: definition.group,
      index: current.index,
      tier: tierForIndex(current.index),
      trend: trendFor(current.index, projected.index),
    },
  };
}

export interface CellModelResult {
  readings: ParasiteRiskReading[];
  overallTier: RiskTier;
  degraded: boolean;
}

/**
 * Compute every applicable parasite reading for a grid cell.
 *
 * `past` must end on the current day. `forecast` is the days after it, used
 * only to derive the trend.
 */
export function computeCellReadings(
  region: RiskRegion,
  lat: number,
  lon: number,
  past: readonly DailyWeather[],
  forecast: readonly DailyWeather[],
): CellModelResult {
  const definitions = catalogueFor(region, lat, lon);
  const full = [...past, ...forecast];

  const results = definitions.map((definition) =>
    readingFor(definition, past, full),
  );

  // Sorted most severe first, so the first entry is both the headline reading
  // and the overall tier.
  const readings = results
    .map((result) => result.reading)
    .sort((a, b) => b.index - a.index);

  return {
    readings,
    overallTier: readings.length > 0 ? readings[0].tier : "LOW",
    degraded: results.some((result) => result.degraded),
  };
}
