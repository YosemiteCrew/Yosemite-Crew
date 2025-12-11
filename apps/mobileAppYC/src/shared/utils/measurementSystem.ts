// Measurement system types
export type MeasurementSystem = 'metric' | 'imperial';
export type WeightUnit = 'kg' | 'lbs';
export type DistanceUnit = 'km' | 'mi';

// Countries that use imperial system (primarily US, Myanmar, Liberia)
const IMPERIAL_COUNTRIES = new Set(['US', 'MM', 'LR']);

/**
 * Determines the measurement system based on country code
 */
export const getMeasurementSystemFromCountryCode = (
  countryCode?: string | null,
): MeasurementSystem => {
  if (!countryCode) return 'metric'; // Default to metric
  return IMPERIAL_COUNTRIES.has(countryCode.toUpperCase())
    ? 'imperial'
    : 'metric';
};

/**
 * Determine measurement system from country name (from countryList.json)
 */
export const getMeasurementSystemFromCountryName = (
  countryName?: string | null,
): MeasurementSystem => {
  if (!countryName) return 'metric';

  const imperialCountryNames = ['United States', 'Myanmar', 'Liberia'];

  return imperialCountryNames.includes(countryName) ? 'imperial' : 'metric';
};

/**
 * Gets the weight unit based on measurement system
 */
export const getWeightUnit = (system: MeasurementSystem): WeightUnit => {
  return system === 'imperial' ? 'lbs' : 'kg';
};

/**
 * Gets the distance unit based on measurement system
 */
export const getDistanceUnit = (system: MeasurementSystem): DistanceUnit => {
  return system === 'imperial' ? 'mi' : 'km';
};

/**
 * Convert weight between units
 */
export const convertWeight = (
  value: number,
  from: WeightUnit,
  to: WeightUnit,
): number => {
  if (from === to) return value;

  if (from === 'kg' && to === 'lbs') {
    return value * 2.20462;
  }

  if (from === 'lbs' && to === 'kg') {
    return value / 2.20462;
  }

  return value;
};

/**
 * Convert distance between units
 */
export const convertDistance = (
  value: number,
  from: DistanceUnit,
  to: DistanceUnit,
): number => {
  if (from === to) return value;

  if (from === 'km' && to === 'mi') {
    return value * 0.621371;
  }

  if (from === 'mi' && to === 'km') {
    return value / 0.621371;
  }

  return value;
};

/**
 * Convert meters to the appropriate distance unit
 */
export const convertMetersToUnit = (
  meters: number,
  unit: DistanceUnit,
): number => {
  if (unit === 'mi') {
    return meters / 1609.344; // meters to miles
  }
  return meters / 1000; // meters to kilometers
};

/**
 * Format weight with appropriate unit
 */
export const formatWeight = (
  value: number | null | undefined,
  unit: WeightUnit,
  decimals: number = 1,
): string => {
  if (value === null || value === undefined) return '';
  return `${value.toFixed(decimals)} ${unit}`;
};

/**
 * Format distance with appropriate unit
 */
export const formatDistance = (
  value: number | null | undefined,
  unit: DistanceUnit,
  decimals: number = 1,
): string => {
  if (value === null || value === undefined) return '';
  return `${value.toFixed(decimals)}${unit}`;
};
