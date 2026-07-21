import type { Appointment } from '@yosemite-crew/types';

import { formatDateInPreferredTimeZone, getDateKeyInPreferredTimeZone } from '@/app/lib/timezone';
import { getLoadDotCount } from './phoneMonthModel';

const DAYS_IN_WEEK = 7;

export type PhoneDayStripCell = {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  weekdayLabel: string;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  appointmentCount: number;
  dotCount: number;
};

export type PhoneDayStripInput = {
  weekStart: Date;
  appointments: readonly Appointment[];
  selectedDate: Date;
  today: Date;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Seven cells from `weekStart`, each carrying its own load. Appointments are
 * bucketed by their calendar-day key in the preferred timezone (the only correct
 * instant -> day conversion), so a late-evening appointment cannot land on the
 * neighbouring cell when the browser sits in a different zone.
 */
export const buildPhoneDayStrip = ({
  weekStart,
  appointments,
  selectedDate,
  today,
}: PhoneDayStripInput): PhoneDayStripCell[] => {
  const counts = new Map<string, number>();
  appointments.forEach((appointment) => {
    const key = getDateKeyInPreferredTimeZone(appointment.startTime);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const todayKey = getDateKeyInPreferredTimeZone(today);
  const selectedKey = getDateKeyInPreferredTimeZone(selectedDate);

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = getDateKeyInPreferredTimeZone(date);
    const appointmentCount = counts.get(dateKey) ?? 0;

    return {
      date,
      dateKey,
      dayOfMonth: date.getDate(),
      // Label by the cell's ACTUAL weekday (in the preferred timezone), not by
      // its position — the strip can start on any day (e.g. a rolling day-picker
      // seeded from the selected date), so a fixed Monday-first list mislabels it.
      weekdayLabel: formatDateInPreferredTimeZone(date, { weekday: 'short' }).toUpperCase(),
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
      isSelected: dateKey === selectedKey,
      appointmentCount,
      dotCount: getLoadDotCount(appointmentCount),
    };
  });
};
