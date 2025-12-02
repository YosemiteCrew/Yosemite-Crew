import type {EmployeeAvailability, SlotWindow} from '@/features/appointments/types';
import {addDays, formatDateToISODate, parseISODate} from '@/shared/utils/dateHelpers';

const sortIsoDates = (a: string, b: string) => a.localeCompare(b);
const DEFAULT_MARKER_WINDOW_DAYS = 30;
const normalizeTimeString = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  const hhmmMatch = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  // If this looks like an ISO date, convert to local HH:mm
  const asDate = new Date(trimmed);
  if (!Number.isNaN(asDate.getTime()) && trimmed.includes('T')) {
    return asDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1]);
    const minutes = hhmmMatch[2];
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHour = ((hours + 11) % 12) + 1;
    return `${displayHour}:${minutes} ${suffix}`;
  }
  return trimmed;
};
const resolveSlotTimes = (slot: SlotWindow) => {
  const start = normalizeTimeString(slot.startTimeLocal ?? slot.startTime);
  const end = normalizeTimeString(slot.endTimeLocal ?? slot.endTime) ?? start;
  return {start, end};
};
const formatSlotLabel = (slot: SlotWindow) => {
  const {start, end} = resolveSlotTimes(slot);
  if (!start) {
    return '';
  }
  return end ? `${start} - ${end}` : start;
};
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
    return sameDaySlots
      .filter(isSlotAvailable)
      .map(formatSlotLabel)
      .filter(label => Boolean(label?.trim?.()));
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

export const findSlotByLabel = (
  availability: EmployeeAvailability | null | undefined,
  date: string,
  label: string | null,
): SlotWindow | null => {
  if (!availability || !label) {
    return null;
  }
  const slots = availability.slotsByDate?.[date] ?? [];
  const normalizedTarget = label.replaceAll(/\s+/g, '').toLowerCase();
  return (
    slots.find(slot => formatSlotLabel(slot).replaceAll(/\s+/g, '').toLowerCase() === normalizedTarget) ??
    null
  );
};
