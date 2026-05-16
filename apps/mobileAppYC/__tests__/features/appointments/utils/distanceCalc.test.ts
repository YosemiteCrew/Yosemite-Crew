import {
  calculateDistanceKm,
  kmToMi,
  miToKm,
} from '../../../../src/features/appointments/utils/distanceCalc';

describe('calculateDistanceKm', () => {
  it('returns 0 for identical coordinates', () => {
    const coord = {lat: 37.7749, lng: -122.4194};
    expect(calculateDistanceKm(coord, coord)).toBeCloseTo(0, 5);
  });

  it('calculates correct distance between SF and Oakland (~13 km great-circle)', () => {
    const sf = {lat: 37.7749, lng: -122.4194};
    const oakland = {lat: 37.8044, lng: -122.2711};
    const dist = calculateDistanceKm(sf, oakland);
    expect(dist).toBeGreaterThan(12);
    expect(dist).toBeLessThan(15);
  });

  it('calculates correct distance between London and Paris (~341 km)', () => {
    const london = {lat: 51.5074, lng: -0.1278};
    const paris = {lat: 48.8566, lng: 2.3522};
    const dist = calculateDistanceKm(london, paris);
    expect(dist).toBeGreaterThan(335);
    expect(dist).toBeLessThan(345);
  });

  it('is symmetric — distance A→B equals B→A', () => {
    const a = {lat: 40.7128, lng: -74.006};
    const b = {lat: 34.0522, lng: -118.2437};
    expect(calculateDistanceKm(a, b)).toBeCloseTo(calculateDistanceKm(b, a), 5);
  });

  it('handles antipodal points (max distance ~20 015 km)', () => {
    const north = {lat: 90, lng: 0};
    const south = {lat: -90, lng: 0};
    const dist = calculateDistanceKm(north, south);
    expect(dist).toBeGreaterThan(20000);
    expect(dist).toBeLessThan(20020);
  });

  it('returns a positive value for any distinct pair', () => {
    const a = {lat: 0, lng: 0};
    const b = {lat: 1, lng: 1};
    expect(calculateDistanceKm(a, b)).toBeGreaterThan(0);
  });

  it('handles negative and mixed-sign coordinates', () => {
    const a = {lat: -33.8688, lng: 151.2093}; // Sydney
    const b = {lat: 51.5074, lng: -0.1278}; // London
    const dist = calculateDistanceKm(a, b);
    expect(dist).toBeGreaterThan(16000);
    expect(dist).toBeLessThan(17000);
  });
});

describe('kmToMi', () => {
  it('converts 0 km to 0 mi', () => {
    expect(kmToMi(0)).toBe(0);
  });

  it('converts 1 km to approximately 0.621371 mi', () => {
    expect(kmToMi(1)).toBeCloseTo(0.621371, 5);
  });

  it('converts 100 km to approximately 62.1371 mi', () => {
    expect(kmToMi(100)).toBeCloseTo(62.1371, 3);
  });

  it('is the inverse of miToKm within floating-point tolerance', () => {
    const km = 42.195;
    expect(kmToMi(miToKm(km))).toBeCloseTo(km, 2);
  });
});

describe('miToKm', () => {
  it('converts 0 mi to 0 km', () => {
    expect(miToKm(0)).toBe(0);
  });

  it('converts 1 mi to approximately 1.60934 km', () => {
    expect(miToKm(1)).toBeCloseTo(1.60934, 4);
  });

  it('converts 26.2 mi (marathon) to approximately 42.165 km', () => {
    expect(miToKm(26.2)).toBeCloseTo(42.165, 1);
  });
});
