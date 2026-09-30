export type MeasurementName =
  'temperature' | 'heartRate' | 'respiratoryRate' | 'painScore' | 'inputMl' | 'outputMl';

// Bounds are physical-plausibility limits for any species, not normal ranges: they stop a
// Fahrenheit reading typed into the Celsius field or a slipped digit, nothing narrower.
export const MEASUREMENT_FIELDS: Array<{
  name: MeasurementName;
  label: string;
  min: number;
  max?: number;
  step: string;
}> = [
  { name: 'temperature', label: 'Temperature (°C)', min: 0, max: 50, step: '0.1' },
  { name: 'heartRate', label: 'Heart rate (bpm)', min: 1, max: 1500, step: '1' },
  { name: 'respiratoryRate', label: 'Respiratory rate (/min)', min: 1, max: 400, step: '1' },
  { name: 'painScore', label: 'Pain score (0–10)', min: 0, max: 10, step: '1' },
  { name: 'inputMl', label: 'Fluid intake (mL)', min: 0, step: '0.01' },
  { name: 'outputMl', label: 'Fluid output (mL)', min: 0, step: '0.01' },
];
