const DROP_TOLERANCE_MINUTES = 12;

export const calcNearestAvailableMinute = (
  minute: number,
  dropAvailabilityIntervals: Array<{ startMinute: number; endMinute: number }>
): number | null => {
  const snapped = Math.round(minute / 5) * 5;
  let bestMatch: { minute: number; distance: number } | null = null;
  for (const interval of dropAvailabilityIntervals) {
    const candidateMinute = Math.max(interval.startMinute, Math.min(interval.endMinute, snapped));
    const distance = Math.abs(minute - candidateMinute);
    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { minute: candidateMinute, distance };
    }
  }
  if (!bestMatch || bestMatch.distance > DROP_TOLERANCE_MINUTES) return null;
  return bestMatch.minute;
};
