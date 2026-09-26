import {
  buildDateInPreferredTimeZone,
  buildPreferredTimeZoneDayInstant,
  getDatePartsInPreferredTimeZone,
  getMinutesSinceStartOfDayInPreferredTimeZone,
} from '@/app/lib/timezone';

export const MAX_WEEKLY_APPOINTMENTS = 52;

export type AppointmentSeriesOccurrence = {
  startTime: Date;
  endTime: Date;
};

export const buildWeeklyAppointmentOccurrences = (
  startTime: Date,
  endTime: Date,
  total: number
): AppointmentSeriesOccurrence[] => {
  if (!Number.isInteger(total) || total < 2 || total > MAX_WEEKLY_APPOINTMENTS) {
    throw new RangeError(`Choose between 2 and ${MAX_WEEKLY_APPOINTMENTS} appointments.`);
  }
  const durationMs = endTime.getTime() - startTime.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError('The appointment end must be after its start.');
  }

  const { year, month, day } = getDatePartsInPreferredTimeZone(startTime);
  const minutes = getMinutesSinceStartOfDayInPreferredTimeZone(startTime);

  return Array.from({ length: total }, (_, index) => {
    const occurrenceDay = buildPreferredTimeZoneDayInstant(year, month, day + index * 7);
    const occurrenceStart = buildDateInPreferredTimeZone(occurrenceDay, minutes);
    return {
      startTime: occurrenceStart,
      endTime: new Date(occurrenceStart.getTime() + durationMs),
    };
  });
};
