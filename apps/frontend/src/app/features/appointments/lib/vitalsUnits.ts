/**
 * Which storage key a vital belongs under, decided by the unit its template declares.
 *
 * Temperature and weight are the only vitals recorded on two scales, and the stored key
 * is the only thing that says which one a bare number is in. Routing by the field's
 * label alone - the previous behaviour - meant a template declaring °C still wrote
 * `tempF`, so 38.5 (a normal canine temperature) read back as severe hypothermia and
 * exported as a confident, wrong clinical claim.
 *
 * Neither scale is converted into the other on save: a clinic reads back the number its
 * clinician typed, and a conversion would round it.
 */

export type TemperatureKey = 'tempF' | 'tempC';
export type WeightKey = 'weightLbs' | 'weightKg';

/**
 * Units are compared on letters alone, so '°C', 'C', 'deg C' and 'Cel' (the UCUM code)
 * all collapse to the same token. Templates are authored by clinics, not validated
 * against a vocabulary, so the spelling varies.
 */
const letters = (unit: string) => unit.toLowerCase().replaceAll(/[^a-z]/g, '');

const CELSIUS = new Set([
  'c',
  'cel',
  'degc',
  'degreesc',
  'celsius',
  'degreescelsius',
  'centigrade',
]);

const KILOGRAM = new Set(['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms']);

/**
 * Fahrenheit and pounds are the fallback for an absent or unrecognised unit, matching
 * what the built-in blueprints declare. `vitalUnitLabel` then renders the unit that
 * matches the key rather than the unrecognised string, so what is displayed can never
 * disagree with what is stored.
 */
export const temperatureKeyForUnit = (unit: string | undefined): TemperatureKey =>
  CELSIUS.has(letters(unit ?? '')) ? 'tempC' : 'tempF';

export const weightKeyForUnit = (unit: string | undefined): WeightKey =>
  KILOGRAM.has(letters(unit ?? '')) ? 'weightKg' : 'weightLbs';

const UNIT_LABELS = {
  tempF: '°F',
  tempC: '°C',
  weightLbs: 'lbs',
  weightKg: 'kg',
} as const;

export const vitalUnitLabel = (key: TemperatureKey | WeightKey): string => UNIT_LABELS[key];

type ScaledVital = {
  tempF?: number;
  tempC?: number;
  weightLbs?: number;
  weightKg?: number;
};

/**
 * The recorded value together with the unit it was recorded in, or null when neither
 * scale carries a reading. Exactly one of each pair is ever populated - the form writes
 * to the key the template resolved to - but a record that somehow carries both prefers
 * the metric key rather than rendering two conflicting numbers.
 */
export type ScaledReading = { value: number; unit: string; key: TemperatureKey | WeightKey };

const reading = (
  metricKey: TemperatureKey | WeightKey,
  metric: number | undefined,
  imperialKey: TemperatureKey | WeightKey,
  imperial: number | undefined
): ScaledReading | null => {
  if (typeof metric === 'number') {
    return { value: metric, unit: vitalUnitLabel(metricKey), key: metricKey };
  }
  if (typeof imperial === 'number') {
    return { value: imperial, unit: vitalUnitLabel(imperialKey), key: imperialKey };
  }
  return null;
};

export const temperatureReading = (vital: ScaledVital | undefined): ScaledReading | null =>
  reading('tempC', vital?.tempC, 'tempF', vital?.tempF);

export const weightReading = (vital: ScaledVital | undefined): ScaledReading | null =>
  reading('weightKg', vital?.weightKg, 'weightLbs', vital?.weightLbs);

/** `27.3 kg`, or the caller's placeholder when the vital carries no reading. */
export const formatReading = (value: ScaledReading | null, placeholder: string): string =>
  value === null ? placeholder : `${value.value} ${value.unit}`;
