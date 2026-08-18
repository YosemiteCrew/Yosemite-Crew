import { Appointment } from '@yosemite-crew/types';
import {
  eventsForDayHour,
  getNextWeek,
  getWeekDays,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import { filterAppointmentsForWeek } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import {
  buildDateInPreferredTimeZone,
  buildPreferredTimeZoneDayInstant,
  getDatePartsInPreferredTimeZone,
  getHourInPreferredTimeZone,
  setPreferredTimeZone,
} from '@/app/lib/timezone';

/** Monday 6 July 2026 at browser-local midnight — the week the desktop grid renders. */
const WEEK_START = new Date(2026, 6, 6);

/** Minutes `timeZone` sits ahead of UTC at `instant`. */
const zoneOffsetMinutes = (timeZone: string, instant: Date): number => {
  const utc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  const zoned = new Date(instant.toLocaleString('en-US', { timeZone }));
  return Math.round((zoned.getTime() - utc.getTime()) / 60_000);
};

const CANDIDATE_ZONES = [
  'Pacific/Pago_Pago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
];

/**
 * A zone at least six hours west of whatever zone the test host runs in, so the
 * divergence between browser-local midnight and the preferred calendar day this
 * suite relies on exists on a UTC CI box and on a developer's laptop alike.
 */
const pickZoneWestOfHost = (reference: Date): string => {
  const hostOffset = -reference.getTimezoneOffset();
  const zone = CANDIDATE_ZONES.find(
    (candidate) => zoneOffsetMinutes(candidate, reference) <= hostOffset - 360
  );
  if (!zone) throw new Error('No candidate timezone is far enough west of the test host.');
  return zone;
};

const makeEvent = (startTime: Date, endTime: Date = startTime): Appointment =>
  ({ startTime, endTime }) as unknown as Appointment;

afterEach(() => {
  window.localStorage.clear();
});

describe('getWeekDays in a preferred timezone west of the host', () => {
  it('labels each column with the preferred calendar day, not the browser day', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const days = getWeekDays(WEEK_START);
    expect(days).toHaveLength(7);
    // Monday 6 July through Sunday 12 July, in the preferred zone.
    days.forEach((day, index) => {
      expect(getDatePartsInPreferredTimeZone(day).day).toBe(6 + index);
    });
  });

  it('buckets an event by its preferred-zone day and hour', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const days = getWeekDays(WEEK_START);
    // Local noon on the preferred Wednesday (8 July) — hour 12 in the preferred zone.
    const eventInstant = buildPreferredTimeZoneDayInstant(2026, 7, 8);
    expect(getHourInPreferredTimeZone(eventInstant)).toBe(12);

    expect(eventsForDayHour([makeEvent(eventInstant)], days[2], 12)).toHaveLength(1);
    expect(eventsForDayHour([makeEvent(eventInstant)], days[1], 12)).toHaveLength(0);
  });

  it('keeps labelling and bucketing after paging to the next week', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const nextWeekStart = getNextWeek(WEEK_START);
    const days = getWeekDays(nextWeekStart);
    // Monday 13 July through Sunday 19 July, in the preferred zone.
    days.forEach((day, index) => {
      expect(getDatePartsInPreferredTimeZone(day).day).toBe(13 + index);
    });

    const eventInstant = buildPreferredTimeZoneDayInstant(2026, 7, 15);
    expect(eventsForDayHour([makeEvent(eventInstant)], days[2], 12)).toHaveLength(1);
    expect(eventsForDayHour([makeEvent(eventInstant)], days[3], 12)).toHaveLength(0);
  });

  it('retains an early-morning event on the first preferred day of the week', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    // 00:30 on the preferred Monday (6 July) — before the noon anchor, so a
    // noon-based lower bound would wrongly drop it.
    const firstDayAnchor = buildPreferredTimeZoneDayInstant(2026, 7, 6);
    const earlyMorning = buildDateInPreferredTimeZone(firstDayAnchor, 30);
    expect(getDatePartsInPreferredTimeZone(earlyMorning).day).toBe(6);

    const retained = filterAppointmentsForWeek([makeEvent(earlyMorning)], WEEK_START);
    expect(retained).toHaveLength(1);
  });
});
