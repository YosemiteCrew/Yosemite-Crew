import { Appointment } from '@yosemite-crew/types';
import {
  eventsForDayHour,
  getWeekDays,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import { filterAppointmentsForWeek } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { isAllDayForDate } from '@/app/features/appointments/components/Calendar/helpers';
import {
  buildDateInPreferredTimeZone,
  getDatePartsInPreferredTimeZone,
  getStartOfNextDayInPreferredTimeZone,
  setPreferredTimeZone,
} from '@/app/lib/timezone';

/** Monday 6 July 2026 at browser-local midnight - the week the desktop grid renders. */
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

describe('week-calendar day columns in a preferred timezone west of the host', () => {
  it('anchors each column on the clinic calendar day, not the browser day', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const days = getWeekDays(WEEK_START);
    expect(days).toHaveLength(7);
    // Monday 6 July through Sunday 12 July, read in the clinic's own timezone -
    // the same numeral a CalendarWeekDayCell would show next to its weekday
    // label. Before the fix, getWeekDays returned browser-local midnight, which
    // this west-of-host zone reads as the PREVIOUS clinic day.
    days.forEach((day, index) => {
      expect(getDatePartsInPreferredTimeZone(day).day).toBe(6 + index);
    });
  });

  it('buckets an event by its clinic-timezone day and hour', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const days = getWeekDays(WEEK_START);
    // Noon on the clinic's Wednesday (8 July), built independently of getWeekDays.
    const eventInstant = buildDateInPreferredTimeZone(days[2], 12 * 60);

    expect(eventsForDayHour([makeEvent(eventInstant)], days[2], 12)).toHaveLength(1);
    expect(eventsForDayHour([makeEvent(eventInstant)], days[1], 12)).toHaveLength(0);
  });

  it('keeps an early-morning event on the first day inside the week range', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    // 00:30 on the clinic's Monday (6 July) - before the noon anchor, so a
    // filter that used the noon-anchored column Date as its lower bound would
    // wrongly drop it from the week.
    const days = getWeekDays(WEEK_START);
    const earlyMonday = buildDateInPreferredTimeZone(days[0], 30);

    const retained = filterAppointmentsForWeek([makeEvent(earlyMonday)], WEEK_START);
    expect(retained).toHaveLength(1);
  });

  it('excludes an event on the clinic day after the week ends', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const days = getWeekDays(WEEK_START);
    // The instant immediately after the clinic's Sunday (12 July) ends -
    // 00:00 on the following Monday.
    const nextWeekMonday = buildDateInPreferredTimeZone(days[6], 24 * 60 - 1);
    const justAfterWeek = new Date(nextWeekMonday.getTime() + 60_000);

    const retained = filterAppointmentsForWeek([makeEvent(justAfterWeek)], WEEK_START);
    expect(retained).toHaveLength(0);
  });

  it('detects an all-day event against the clinic day of a noon-anchored column', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const days = getWeekDays(WEEK_START);
    const wednesday = days[2];
    const clinicMidnight = buildDateInPreferredTimeZone(wednesday, 0);
    // The exact instant isAllDayForDate itself treats as the end of the clinic
    // day - buildDateInPreferredTimeZone only has minute precision, so 23:59:00
    // one minute shy of that boundary would (correctly) not count as all-day.
    const clinicDayEnd = new Date(getStartOfNextDayInPreferredTimeZone(wednesday).getTime() - 1);

    const spansFullClinicDay = makeEvent(clinicMidnight, clinicDayEnd);
    expect(isAllDayForDate(spansFullClinicDay, wednesday)).toBe(true);

    // A morning-only slice of the same clinic day is not all-day.
    const morningOnly = makeEvent(clinicMidnight, buildDateInPreferredTimeZone(wednesday, 9 * 60));
    expect(isAllDayForDate(morningOnly, wednesday)).toBe(false);
  });
});
