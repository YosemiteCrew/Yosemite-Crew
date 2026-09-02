import {
  formatReading,
  temperatureKeyForUnit,
  temperatureReading,
  vitalUnitLabel,
  weightKeyForUnit,
  weightReading,
} from '@/app/features/appointments/lib/vitalsUnits';

describe('temperatureKeyForUnit', () => {
  // Templates are authored by clinics against no vocabulary, so the same scale
  // arrives spelled several ways. Each of these must reach tempC, because the
  // key is the only record of which scale the stored number is on.
  it.each(['°C', 'C', 'c', ' deg C ', 'Cel', 'celsius', 'Celsius', 'centigrade'])(
    'reads %p as Celsius',
    (unit) => {
      expect(temperatureKeyForUnit(unit)).toBe('tempC');
    }
  );

  it.each(['°F', 'F', 'degF', 'Fahrenheit', '[degF]'])('reads %p as Fahrenheit', (unit) => {
    expect(temperatureKeyForUnit(unit)).toBe('tempF');
  });

  it('falls back to Fahrenheit for an absent or unrecognised unit', () => {
    expect(temperatureKeyForUnit(undefined)).toBe('tempF');
    expect(temperatureKeyForUnit('')).toBe('tempF');
    expect(temperatureKeyForUnit('kelvin')).toBe('tempF');
  });
});

describe('weightKeyForUnit', () => {
  it.each(['kg', 'KG', ' kgs ', 'kilo', 'kilos', 'kilogram', 'kilograms'])(
    'reads %p as kilograms',
    (unit) => {
      expect(weightKeyForUnit(unit)).toBe('weightKg');
    }
  );

  it.each(['lbs', 'lb', 'pounds', '[lb_av]'])('reads %p as pounds', (unit) => {
    expect(weightKeyForUnit(unit)).toBe('weightLbs');
  });

  it('falls back to pounds for an absent or unrecognised unit', () => {
    expect(weightKeyForUnit(undefined)).toBe('weightLbs');
    expect(weightKeyForUnit('stones')).toBe('weightLbs');
  });
});

describe('vitalUnitLabel', () => {
  it('labels each scale with the unit its key means', () => {
    expect(vitalUnitLabel('tempF')).toBe('°F');
    expect(vitalUnitLabel('tempC')).toBe('°C');
    expect(vitalUnitLabel('weightLbs')).toBe('lbs');
    expect(vitalUnitLabel('weightKg')).toBe('kg');
  });
});

describe('temperatureReading', () => {
  it('reports a Fahrenheit reading with °F', () => {
    expect(temperatureReading({ tempF: 101.4 })).toEqual({
      value: 101.4,
      unit: '°F',
      key: 'tempF',
    });
  });

  it('reports a Celsius reading with °C rather than relabelling it Fahrenheit', () => {
    expect(temperatureReading({ tempC: 38.5 })).toEqual({ value: 38.5, unit: '°C', key: 'tempC' });
  });

  it('prefers the metric key when a record somehow carries both', () => {
    expect(temperatureReading({ tempC: 38.5, tempF: 101.3 })?.key).toBe('tempC');
  });

  it('returns null when neither scale carries a reading', () => {
    expect(temperatureReading({})).toBeNull();
    expect(temperatureReading(undefined)).toBeNull();
  });

  it('treats a non-numeric value as absent rather than rendering it', () => {
    // The vitals column is untyped JSON, so a bad row must not reach the UI as
    // "null °C".
    expect(temperatureReading({ tempC: undefined, tempF: 99 })?.key).toBe('tempF');
  });

  it('keeps a zero reading, which is falsy but recorded', () => {
    expect(temperatureReading({ tempC: 0 })).toEqual({ value: 0, unit: '°C', key: 'tempC' });
  });
});

describe('weightReading', () => {
  it('reports each scale under its own unit', () => {
    expect(weightReading({ weightLbs: 62 })).toEqual({ value: 62, unit: 'lbs', key: 'weightLbs' });
    expect(weightReading({ weightKg: 27.3 })).toEqual({ value: 27.3, unit: 'kg', key: 'weightKg' });
  });

  it('prefers the metric key when a record somehow carries both', () => {
    expect(weightReading({ weightKg: 28, weightLbs: 62 })?.key).toBe('weightKg');
  });

  it('returns null when neither scale carries a reading', () => {
    expect(weightReading({})).toBeNull();
  });
});

describe('formatReading', () => {
  it('renders the value with the unit it was recorded in', () => {
    expect(formatReading(weightReading({ weightKg: 27.3 }), '-')).toBe('27.3 kg');
    expect(formatReading(temperatureReading({ tempF: 101.4 }), '-')).toBe('101.4 °F');
  });

  it('uses the placeholder the caller supplies when there is no reading', () => {
    expect(formatReading(null, '—')).toBe('—');
    expect(formatReading(null, '-')).toBe('-');
  });
});
