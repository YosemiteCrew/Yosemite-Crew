export const toRadians = (value: number) => (value * Math.PI) / 180;

export const calculateDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

type CoordinatesLike = {
  latitude?: number | null;
  longitude?: number | null;
};

export const getBoundingDeltas = (lat: number, radiusMeters: number) => {
  const metersPerDegreeLat = 111000;
  return {
    latDelta: radiusMeters / metersPerDegreeLat,
    lngDelta: radiusMeters / (metersPerDegreeLat * Math.cos(toRadians(lat))),
  };
};

export const filterWithinRadius = <
  TItem extends { address?: CoordinatesLike | null },
>(
  items: TItem[],
  lat: number,
  lng: number,
  radiusMeters: number,
) =>
  items.filter((item) => {
    if (item.address?.latitude == null || item.address?.longitude == null) {
      return false;
    }

    const distance = calculateDistanceMeters(
      lat,
      lng,
      item.address.latitude,
      item.address.longitude,
    );
    return distance <= radiusMeters;
  });
