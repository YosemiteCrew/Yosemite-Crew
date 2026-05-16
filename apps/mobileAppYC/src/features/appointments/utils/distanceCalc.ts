export interface Coords {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

const toRad = (deg: number): number => deg * DEG_TO_RAD;
export const calculateDistanceKm = (from: Coords, to: Coords): number => {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

export const kmToMi = (km: number): number => km * 0.621371;

export const miToKm = (mi: number): number => mi * 1.60934;
