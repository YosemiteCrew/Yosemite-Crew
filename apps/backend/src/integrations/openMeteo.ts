import axios, { type AxiosInstance } from "axios";
import type { DailyWeather } from "src/services/parasite-risk.model";
import logger from "src/utils/logger";

/**
 * Open-Meteo client for the parasite risk models.
 *
 * Free, keyless, and global, which is what lets one engine cover AU, US and EU
 * identically.
 *
 * Security note: the base URL is a hardcoded constant and the only values that
 * ever reach the request are numbers we have range-checked ourselves. No
 * caller-supplied string is interpolated into the URL, so there is no path by
 * which this becomes a server-side request forgery.
 */

const OPEN_METEO_BASE_URL = "https://api.open-meteo.com";
const FORECAST_PATH = "/v1/forecast";

/** Enough history for the longest model window (30 days) plus headroom. */
const PAST_DAYS = 35;
/** Open-Meteo counts the current day as the first forecast day, so this is today plus seven. */
const FORECAST_DAYS = 8;

const DAILY_VARIABLES = [
  "temperature_2m_max",
  "temperature_2m_min",
  "temperature_2m_mean",
  "precipitation_sum",
  "relative_humidity_2m_mean",
  "dew_point_2m_mean",
].join(",");

export class OpenMeteoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenMeteoError";
  }
}

interface OpenMeteoDailyPayload {
  time?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  temperature_2m_mean?: unknown;
  precipitation_sum?: unknown;
  relative_humidity_2m_mean?: unknown;
  dew_point_2m_mean?: unknown;
}

let client: AxiosInstance | null = null;

const getClient = (): AxiosInstance => {
  client ??= axios.create({
    baseURL: OPEN_METEO_BASE_URL,
    timeout: 10_000,
    headers: { Accept: "application/json" },
  });
  return client;
};

const asNumberArray = (value: unknown): (number | null)[] =>
  Array.isArray(value)
    ? value.map((entry) => (typeof entry === "number" ? entry : null))
    : [];

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const isFiniteCoordinate = (value: number, limit: number): boolean =>
  Number.isFinite(value) && Math.abs(value) <= limit;

export interface CellWeatherSeries {
  /** Ordered oldest first, ending on the current day. */
  past: DailyWeather[];
  /** Ordered oldest first, starting the day after the current day. */
  forecast: DailyWeather[];
}

/**
 * Fetch the daily weather series for a grid cell centre.
 *
 * Splits the response at today so the models can compute a current index from
 * observed weather and a projected index from the forecast.
 */
export async function fetchCellWeather(
  lat: number,
  lon: number,
): Promise<CellWeatherSeries> {
  if (!isFiniteCoordinate(lat, 90) || !isFiniteCoordinate(lon, 180)) {
    throw new OpenMeteoError(`Coordinate out of range: ${lat}, ${lon}`);
  }

  let payload: { daily?: OpenMeteoDailyPayload };

  try {
    const response = await getClient().get<{ daily?: OpenMeteoDailyPayload }>(
      FORECAST_PATH,
      {
        params: {
          latitude: lat,
          longitude: lon,
          daily: DAILY_VARIABLES,
          past_days: PAST_DAYS,
          forecast_days: FORECAST_DAYS,
          timezone: "auto",
        },
      },
    );
    payload = response.data;
  } catch (error) {
    logger.error("Open-Meteo request failed", { error });
    throw new OpenMeteoError("Weather provider is unavailable");
  }

  const daily = payload.daily ?? {};
  const dates = asStringArray(daily.time);

  if (dates.length === 0) {
    throw new OpenMeteoError("Weather provider returned no daily series");
  }

  const tMax = asNumberArray(daily.temperature_2m_max);
  const tMin = asNumberArray(daily.temperature_2m_min);
  const tMean = asNumberArray(daily.temperature_2m_mean);
  const precipitation = asNumberArray(daily.precipitation_sum);
  const humidity = asNumberArray(daily.relative_humidity_2m_mean);
  const dewPoint = asNumberArray(daily.dew_point_2m_mean);

  const days: DailyWeather[] = dates.flatMap((date, i) => {
    const meanTemp = tMean[i] ?? averageOf(tMax[i], tMin[i]);
    // A day with no usable temperature cannot contribute to any model.
    if (meanTemp === null) return [];

    return [
      {
        date,
        tMean: meanTemp,
        tMax: tMax[i] ?? meanTemp,
        tMin: tMin[i] ?? meanTemp,
        precipitationMm: precipitation[i] ?? 0,
        humidityPct: humidity[i],
        dewPointC: dewPoint[i],
      },
    ];
  });

  // Open-Meteo returns PAST_DAYS of history followed by the forecast block,
  // whose first entry is the current day in the cell's own timezone. Split on
  // that date rather than on an index, because dropping an unusable day above
  // would otherwise shift the boundary. ISO dates sort lexicographically.
  const currentDate =
    dates[Math.max(0, dates.length - FORECAST_DAYS)] ?? dates[dates.length - 1];

  return {
    past: days.filter((day) => day.date <= currentDate),
    forecast: days.filter((day) => day.date > currentDate),
  };
}

function averageOf(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return (a + b) / 2;
}

/** Exposed for tests so a suite can reset the memoised axios instance. */
export function __resetOpenMeteoClient(): void {
  client = null;
}
