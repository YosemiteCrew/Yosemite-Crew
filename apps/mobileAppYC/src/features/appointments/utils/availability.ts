import type {EmployeeAvailability} from '@/features/appointments/types';

const sortIsoDates = (a: string, b: string) => a.localeCompare(b);

export const getFirstAvailableDate = (
  availability: EmployeeAvailability | null | undefined,
  todayISO: string,
  fallback?: string,
) => {
  if (!availability) {
    return fallback ?? todayISO;
  }

  const dates = Object.keys(availability.slotsByDate)
    .filter(date => date >= todayISO)
    .sort(sortIsoDates);

  if (dates.length > 0) {
    return dates[0];
  }

  return fallback ?? todayISO;
};

export const getSlotsForDate = (
  availability: EmployeeAvailability | null | undefined,
  date: string,
  todayISO: string,
) => {
  if (!availability) {
    return [];
  }

  const sameDaySlots = availability.slotsByDate?.[date];
  if (sameDaySlots?.length) {
    return sameDaySlots;
  }

  return Object.entries(availability.slotsByDate)
    .filter(([iso]) => iso >= todayISO)
    .flatMap(([, values]) => values);
};

export const getFutureAvailabilityMarkers = (
  availability: EmployeeAvailability | null | undefined,
  todayISO: string,
) => {
  const markers = new Set<string>();
  if (!availability) {
    return markers;
  }

  for (const key of Object.keys(availability.slotsByDate)) {
    if (key >= todayISO) {
      markers.add(key);
    }
  }

  return markers;
};
