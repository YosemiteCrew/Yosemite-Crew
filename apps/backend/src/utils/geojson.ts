export type GeoPoint = { type: "Point"; coordinates: [number, number] };

export const buildGeoPoint = (input: {
  latitude: number | undefined;
  longitude: number | undefined;
}): GeoPoint | undefined => {
  const { latitude, longitude } = input;

  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return { type: "Point", coordinates: [longitude, latitude] };
};
