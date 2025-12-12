import {
  getMeasurementSystemFromCountryCode,
  getMeasurementSystemFromCountryName,
  getWeightUnit,
  getDistanceUnit,
  convertWeight,
  convertDistance,
  convertMetersToUnit,
  formatWeight,
  formatDistance,
} from '../../src/shared/utils/measurementSystem';

describe('Measurement System Utilities', () => {
  // --- 1. System Detection ---

  describe('getMeasurementSystemFromCountryCode', () => {
    it('returns "imperial" for US, MM, LR', () => {
      expect(getMeasurementSystemFromCountryCode('US')).toBe('imperial');
      expect(getMeasurementSystemFromCountryCode('MM')).toBe('imperial');
      expect(getMeasurementSystemFromCountryCode('LR')).toBe('imperial');
    });

    it('returns "metric" for other country codes', () => {
      expect(getMeasurementSystemFromCountryCode('GB')).toBe('metric');
      expect(getMeasurementSystemFromCountryCode('CA')).toBe('metric');
      expect(getMeasurementSystemFromCountryCode('IN')).toBe('metric');
    });

    it('returns "metric" if country code is missing or null', () => {
      expect(getMeasurementSystemFromCountryCode(null)).toBe('metric');
      expect(getMeasurementSystemFromCountryCode(undefined)).toBe('metric');
      expect(getMeasurementSystemFromCountryCode('')).toBe('metric');
    });

    it('handles case insensitivity correctly', () => {
      expect(getMeasurementSystemFromCountryCode('us')).toBe('imperial');
      expect(getMeasurementSystemFromCountryCode('gb')).toBe('metric');
    });
  });

  describe('getMeasurementSystemFromCountryName', () => {
    it('returns "imperial" for United States, Myanmar, Liberia', () => {
      expect(getMeasurementSystemFromCountryName('United States')).toBe('imperial');
      expect(getMeasurementSystemFromCountryName('Myanmar')).toBe('imperial');
      expect(getMeasurementSystemFromCountryName('Liberia')).toBe('imperial');
    });

    it('returns "metric" for other country names', () => {
      expect(getMeasurementSystemFromCountryName('Canada')).toBe('metric');
      expect(getMeasurementSystemFromCountryName('United Kingdom')).toBe('metric');
    });

    it('returns "metric" if country name is missing or null', () => {
      expect(getMeasurementSystemFromCountryName(null)).toBe('metric');
      expect(getMeasurementSystemFromCountryName(undefined)).toBe('metric');
      expect(getMeasurementSystemFromCountryName('')).toBe('metric');
    });
  });

  // --- 2. Unit Getters ---

  describe('getWeightUnit', () => {
    it('returns "lbs" for imperial system', () => {
      expect(getWeightUnit('imperial')).toBe('lbs');
    });

    it('returns "kg" for metric system', () => {
      expect(getWeightUnit('metric')).toBe('kg');
    });
  });

  describe('getDistanceUnit', () => {
    it('returns "mi" for imperial system', () => {
      expect(getDistanceUnit('imperial')).toBe('mi');
    });

    it('returns "km" for metric system', () => {
      expect(getDistanceUnit('metric')).toBe('km');
    });
  });

  // --- 3. Conversions ---

  describe('convertWeight', () => {
    it('returns value as-is if units are the same', () => {
      expect(convertWeight(100, 'kg', 'kg')).toBe(100);
      expect(convertWeight(50, 'lbs', 'lbs')).toBe(50);
    });

    it('converts kg to lbs correctly', () => {
      // 1 kg = 2.20462 lbs
      const result = convertWeight(10, 'kg', 'lbs');
      expect(result).toBeCloseTo(22.0462, 4);
    });

    it('converts lbs to kg correctly', () => {
      // 10 lbs / 2.20462
      const result = convertWeight(22.0462, 'lbs', 'kg');
      expect(result).toBeCloseTo(10, 4);
    });

    it('returns original value if conversion path is not handled', () => {
      // This test ensures line 66 (the final fallback return) is covered
      // We explicitly pass an invalid unit to force the function to skip 'if' blocks
      const result = convertWeight(100, 'kg', 'stone' as any);
      expect(result).toBe(100);
    });
  });

  describe('convertDistance', () => {
    it('returns value as-is if units are the same', () => {
      expect(convertDistance(100, 'km', 'km')).toBe(100);
      expect(convertDistance(50, 'mi', 'mi')).toBe(50);
    });

    it('converts km to mi correctly', () => {
      // 10 km * 0.621371
      const result = convertDistance(10, 'km', 'mi');
      expect(result).toBeCloseTo(6.21371, 5);
    });

    it('converts mi to km correctly', () => {
      // 6.21371 mi / 0.621371
      const result = convertDistance(6.21371, 'mi', 'km');
      expect(result).toBeCloseTo(10, 5);
    });

    it('returns original value if conversion path is not handled', () => {
      // This test ensures line 87 (the final fallback return) is covered
      const result = convertDistance(100, 'km', 'yards' as any);
      expect(result).toBe(100);
    });
  });

  describe('convertMetersToUnit', () => {
    it('converts meters to miles correctly', () => {
      // 1609.344 meters = 1 mile
      const result = convertMetersToUnit(1609.344, 'mi');
      expect(result).toBeCloseTo(1, 4);
    });

    it('converts meters to kilometers correctly', () => {
      // 1000 meters = 1 km
      const result = convertMetersToUnit(1000, 'km');
      expect(result).toBe(1);
    });
  });

  // --- 4. Formatting ---

  describe('formatWeight', () => {
    it('formats valid weight with unit and default decimals', () => {
      expect(formatWeight(10.555, 'kg')).toBe('10.6 kg');
    });

    it('formats valid weight with custom decimals', () => {
      // Use 10.556 to ensure rounding up to 10.56 is consistent across environments
      expect(formatWeight(10.556, 'lbs', 2)).toBe('10.56 lbs');
    });

    it('returns empty string if value is null or undefined', () => {
      expect(formatWeight(null, 'kg')).toBe('');
      expect(formatWeight(undefined, 'lbs')).toBe('');
    });
  });

  describe('formatDistance', () => {
    it('formats valid distance with unit and default decimals', () => {
      // Note: Implementation does NOT include space between value and unit
      expect(formatDistance(10.555, 'km')).toBe('10.6km');
    });

    it('formats valid distance with custom decimals', () => {
      // Use 10.556 to ensure consistent rounding
      expect(formatDistance(10.556, 'mi', 2)).toBe('10.56mi');
    });

    it('returns empty string if value is null or undefined', () => {
      expect(formatDistance(null, 'km')).toBe('');
      expect(formatDistance(undefined, 'mi')).toBe('');
    });
  });
});