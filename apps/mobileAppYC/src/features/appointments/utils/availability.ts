import type {EmployeeAvailability, SlotWindow} from '@/features/appointments/types';
import {addDays, formatDateToISODate, parseISODate} from '@/shared/utils/dateHelpers';

const sortIsoDates = (a: string, b: string) => a.localeCompare(b);
const DEFAULT_MARKER_WINDOW_DAYS = 30;
const formatSlotLabel = (slot: SlotWindow) => `${slot.startTime} - ${slot.endTime}`;
const isSlotAvailable = (slot: SlotWindow) => slot.isAvailable !== false;

export const getFirstAvailableDate = (
  availability: EmployeeAvailability | null | undefined,
  todayISO: string,
  fallback?: string,
) => {
  if (!availability) {
    return fallback ?? todayISO;
  }

  const dates = Object.entries(availability.slotsByDate)
    .filter(([date, slots]) => date >= todayISO && slots.some(isSlotAvailable))
    .map(([date]) => date)
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

  if (!availability) {
    return [];
  }

  const sameDaySlots = availability.slotsByDate?.[date];
  if (sameDaySlots?.length) {
    return sameDaySlots.filter(isSlotAvailable).map(formatSlotLabel);
  }

  return [];
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
    for (const [key, slots] of Object.entries(availability.slotsByDate)) {
      if (key >= todayISO && slots.some(isSlotAvailable)) {
        markers.add(key);
      }
    }
  }

  return markers;
};

export const parseSlotLabel = (
  value: string | null | undefined,
): {startTime: string | null; endTime: string | null} => {
  if (!value) {
    return {startTime: null, endTime: null};
  }
  const [start, end] = value.split('-').map(part => part.trim());
  return {startTime: start || null, endTime: end || null};
};
