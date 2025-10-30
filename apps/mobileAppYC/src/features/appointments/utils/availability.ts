import type {EmployeeAvailability} from '@/features/appointments/types';
import {addDays, formatDateToISODate, parseISODate} from '@/shared/utils/dateHelpers';

const sortIsoDates = (a: string, b: string) => a.localeCompare(b);
const DEFAULT_TIME_SLOTS = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30'];
const DEFAULT_MARKER_WINDOW_DAYS = 30;

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
  if (date < todayISO) {
    return [];
  }

  if (availability) {
    const sameDaySlots = availability.slotsByDate?.[date];
    if (sameDaySlots?.length) {
      return sameDaySlots;
    }

    const futureSlots = Object.entries(availability.slotsByDate ?? {})
      .filter(([iso]) => iso >= todayISO)
      .flatMap(([, values]) => values);

    if (futureSlots.length > 0) {
      return futureSlots;
    }
  }

  return DEFAULT_TIME_SLOTS;
};

export const getFutureAvailabilityMarkers = (
  availability: EmployeeAvailability | null | undefined,
  todayISO: string,
) => {
  const markers = new Set<string>();
  const baseDate = parseISODate(todayISO);

  if (!Number.isNaN(baseDate.getTime())) {
    for (let i = 0; i < DEFAULT_MARKER_WINDOW_DAYS; i++) {
      markers.add(formatDateToISODate(addDays(baseDate, i)));
    }
  }

  if (availability) {
    for (const key of Object.keys(availability.slotsByDate)) {
      if (key >= todayISO) {
        markers.add(key);
      }
    }
  }

  return markers;
};
