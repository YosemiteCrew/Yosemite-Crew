import {distanceBetweenCoordsMeters} from '../../src/shared/utils/geoDistance';

describe('geoDistance utils', () => {
  describe('distanceBetweenCoordsMeters', () => {
    // --- 1. Validation Logic (Branch Coverage) ---

    it('returns null if lat1 is null or undefined', () => {
      expect(distanceBetweenCoordsMeters(null, 0, 0, 0)).toBeNull();
      expect(distanceBetweenCoordsMeters(undefined, 0, 0, 0)).toBeNull();
    });

    it('returns null if lon1 is null or undefined', () => {
      expect(distanceBetweenCoordsMeters(0, null, 0, 0)).toBeNull();
      expect(distanceBetweenCoordsMeters(0, undefined, 0, 0)).toBeNull();
    });

    it('returns null if lat2 is null or undefined', () => {
      expect(distanceBetweenCoordsMeters(0, 0, null, 0)).toBeNull();
      expect(distanceBetweenCoordsMeters(0, 0, undefined, 0)).toBeNull();
    });

    it('returns null if lon2 is null or undefined', () => {
      expect(distanceBetweenCoordsMeters(0, 0, 0, null)).toBeNull();
      expect(distanceBetweenCoordsMeters(0, 0, 0, undefined)).toBeNull();
    });

    // --- 2. Calculation Logic (Statement/Func Coverage) ---

    it('returns 0 if coordinates are identical', () => {
      const result = distanceBetweenCoordsMeters(40.7128, -74.006, 40.7128, -74.006);
      expect(result).toBe(0);
    });

    it('calculates the correct distance for 1 degree of latitude at the equator', () => {
      // 1 degree of latitude is approximately 111,195 meters (R * PI / 180)
      // R = 6371000
      // 6371000 * (3.1415926535... / 180) ≈ 111194.9
      const result = distanceBetweenCoordsMeters(0, 0, 1, 0);

      // We check for close proximity to account for floating point nuances
      expect(result).toBeCloseTo(111194.9, 0);
    });

    it('calculates distance accurately between two distinct points (e.g., NY to London)', () => {
      // New York (40.7128° N, 74.0060° W)
      // London (51.5074° N, 0.1278° W)
      // Distance should be approximately 5,570,000 meters (5,570 km)

      const nyLat = 40.7128;
      const nyLon = -74.006;
      const londonLat = 51.5074;
      const londonLon = -0.1278;

      const result = distanceBetweenCoordsMeters(nyLat, nyLon, londonLat, londonLon);

      // Verify range to ensure formula implementation is correct (approx 5570km)
      expect(result).toBeGreaterThan(5500000);
      expect(result).toBeLessThan(5600000);
    });
  });
});