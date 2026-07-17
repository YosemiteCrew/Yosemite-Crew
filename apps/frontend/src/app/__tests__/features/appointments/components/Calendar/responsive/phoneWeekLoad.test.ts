import type { Appointment } from '@yosemite-crew/types';

import { setPreferredTimeZone } from '@/app/lib/timezone';

import {
  buildPhoneWeekOverview,
  DEFAULT_DAY_CAPACITY,
  formatWeekRange,
  getIsoWeekNumber,
  getWeekDates,
  SEGMENT_COLORS,
  toDateKey,
  type PhoneWeekDayMeta,
} from '@/app/features/appointments/components/Calendar/responsive/phoneWeekLoad';

/** Monday 6 July 2026 — the week the design renders ("6 – 12 Jul", Week 28). */
const WEEK_START = new Date(2026, 6, 6);

let idCounter = 0;

type AppointmentOverrides = {
  status?: Appointment['status'];
  isEmergency?: boolean;
  leadId?: string;
};

/**
 * Fixtures sit at local midday, not local midnight. Appointments are bucketed by
 * their calendar day in the *preferred* timezone, so a midnight instant would
 * slide into the previous day on any host east of that zone and break these
 * assertions for reasons that have nothing to do with what they test.
 */
const atLocalTime = (date: Date, hours: number, minutes = 0): Date => {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const makeAppointment = (date: Date, overrides: AppointmentOverrides = {}): Appointment => {
  idCounter += 1;
  const { status = 'UPCOMING', isEmergency = false, leadId = 'vet-1' } = overrides;
  const midday = atLocalTime(date, 12);
  return {
    id: `appt-${idCounter}`,
    patient: {
      id: 'pet-1',
      name: 'Rex',
      species: 'Dog',
      parent: { id: 'parent-1', name: 'Ada' },
    },
    lead: { id: leadId, name: 'Dr. Keller' },
    organisationId: 'org-1',
    appointmentDate: midday,
    startTime: midday,
    endTime: midday,
    timeSlot: '09:00',
    durationMinutes: 30,
    status,
    isEmergency,
  };
};

/** `count` appointments on `date`, all sharing the same overrides. */
const makeMany = (date: Date, count: number, overrides: AppointmentOverrides = {}) =>
  Array.from({ length: count }, () => makeAppointment(date, overrides));

const dayOfWeek = (offset: number): Date => {
  const date = new Date(WEEK_START);
  date.setDate(WEEK_START.getDate() + offset);
  return date;
};

const MONDAY = dayOfWeek(0);
const TUESDAY = dayOfWeek(1);
const SUNDAY = dayOfWeek(6);

const build = (
  appointments: Appointment[],
  dayMeta?: Record<string, PhoneWeekDayMeta>,
  defaultCapacity?: number
) => buildPhoneWeekOverview({ weekStart: WEEK_START, appointments, dayMeta, defaultCapacity });

beforeEach(() => {
  idCounter = 0;
});

describe('toDateKey', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 25))).toBe('2026-12-25');
  });

  it('uses the local day, not the UTC day, for a late-evening timestamp', () => {
    expect(toDateKey(new Date(2026, 6, 6, 23, 30))).toBe('2026-07-06');
  });
});

describe('getWeekDates', () => {
  it('returns seven consecutive days starting at the week start', () => {
    const dates = getWeekDates(WEEK_START);
    expect(dates).toHaveLength(7);
    expect(dates.map(toDateKey)).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });

  it('normalises the start to midnight and crosses a month boundary', () => {
    const dates = getWeekDates(new Date(2026, 5, 29, 17, 45));
    expect(dates[0].getHours()).toBe(0);
    expect(toDateKey(dates[6])).toBe('2026-07-05');
  });
});

describe('getIsoWeekNumber', () => {
  it('numbers the design week as 28', () => {
    expect(getIsoWeekNumber(WEEK_START)).toBe(28);
  });

  it('treats Sunday as the last day of its ISO week, not the first', () => {
    // Sunday 12 Jul 2026 closes week 28; Monday 13 Jul opens week 29.
    expect(getIsoWeekNumber(new Date(2026, 6, 12))).toBe(28);
    expect(getIsoWeekNumber(new Date(2026, 6, 13))).toBe(29);
  });

  it('assigns early-January days to the previous year final week', () => {
    // 1 Jan 2027 is a Friday, so it belongs to ISO week 53 of 2026.
    expect(getIsoWeekNumber(new Date(2027, 0, 1))).toBe(53);
  });

  it('assigns a late-December day to week 1 of the next year', () => {
    // 31 Dec 2029 is a Monday whose Thursday lands in 2030 — ISO week 1.
    expect(getIsoWeekNumber(new Date(2029, 11, 31))).toBe(1);
  });
});

describe('formatWeekRange', () => {
  it('prints the month once when the week sits inside one month', () => {
    expect(formatWeekRange(new Date(2026, 6, 6), new Date(2026, 6, 12))).toBe('6 – 12 Jul');
  });

  it('prints both months when the week straddles a month boundary', () => {
    expect(formatWeekRange(new Date(2026, 5, 29), new Date(2026, 6, 5))).toBe('29 Jun – 5 Jul');
  });

  it('prints both months when the week straddles a year boundary', () => {
    expect(formatWeekRange(new Date(2026, 11, 28), new Date(2027, 0, 3))).toBe('28 Dec – 3 Jan');
  });
});

describe('buildPhoneWeekOverview — header', () => {
  it('labels an empty week with zero appointments and zero vets', () => {
    const overview = build([]);
    expect(overview.rangeLabel).toBe('6 – 12 Jul');
    expect(overview.weekLabel).toBe('Week 28');
    expect(overview.summaryLabel).toBe('0 appointments · 0 vets');
    expect(overview.totalAppointments).toBe(0);
    expect(overview.vetCount).toBe(0);
  });

  it('totals appointments and counts distinct vets across the week', () => {
    const overview = build([
      ...makeMany(MONDAY, 2, { leadId: 'vet-1' }),
      ...makeMany(TUESDAY, 3, { leadId: 'vet-2' }),
      makeAppointment(TUESDAY, { leadId: 'vet-1' }),
      makeAppointment(SUNDAY, { leadId: 'vet-3' }),
    ]);
    expect(overview.totalAppointments).toBe(7);
    expect(overview.vetCount).toBe(3);
    expect(overview.summaryLabel).toBe('7 appointments · 3 vets');
  });

  it('uses singular wording for exactly one appointment and one vet', () => {
    const overview = build([makeAppointment(MONDAY, { leadId: 'vet-1' })]);
    expect(overview.summaryLabel).toBe('1 appointment · 1 vet');
  });

  it('ignores appointments outside the displayed week', () => {
    const nextWeek = new Date(2026, 6, 20);
    const overview = build([makeAppointment(MONDAY), makeAppointment(nextWeek)]);
    expect(overview.totalAppointments).toBe(1);
  });

  it('does not count a vet whose only appointment is cancelled', () => {
    const overview = build([
      makeAppointment(MONDAY, { leadId: 'vet-1' }),
      makeAppointment(TUESDAY, { leadId: 'vet-2', status: 'CANCELLED' }),
    ]);
    expect(overview.vetCount).toBe(1);
  });

  it('does not count vets from a closed day', () => {
    const overview = build([makeAppointment(SUNDAY, { leadId: 'vet-9' })], {
      [toDateKey(SUNDAY)]: { isClosed: true },
    });
    expect(overview.vetCount).toBe(0);
  });

  it('tolerates an appointment with no lead assigned', () => {
    const appointment = makeAppointment(MONDAY);
    delete appointment.lead;
    const overview = build([appointment]);
    expect(overview.vetCount).toBe(0);
    expect(overview.totalAppointments).toBe(1);
  });

  it('always emits seven day rows, in order', () => {
    const overview = build([]);
    expect(overview.days.map((day) => day.weekdayLabel)).toEqual([
      'MON',
      'TUE',
      'WED',
      'THU',
      'FRI',
      'SAT',
      'SUN',
    ]);
    expect(overview.days.map((day) => day.dayOfMonthLabel)).toEqual([
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ]);
  });
});

describe('buildPhoneWeekOverview — summary wording', () => {
  const monday = () => build([]).days[0];

  it('reads "No appointments" for an empty, open day with no note', () => {
    const day = monday();
    expect(day.summary).toBe('No appointments');
    expect(day.tone).toBe('normal');
    expect(day.segments).toEqual([]);
    expect(day.showLoadBar).toBe(true);
  });

  it('reads "Closed" and drops the bar for a closed day', () => {
    const overview = build(makeMany(SUNDAY, 3), { [toDateKey(SUNDAY)]: { isClosed: true } });
    const sunday = overview.days[6];
    expect(sunday.summary).toBe('Closed');
    expect(sunday.tone).toBe('closed');
    expect(sunday.showLoadBar).toBe(false);
    expect(sunday.segments).toEqual([]);
    expect(sunday.appointmentCount).toBe(0);
    expect(sunday.flag).toBeNull();
  });

  it('uses the long form when every appointment is done', () => {
    const overview = build(makeMany(MONDAY, 8, { status: 'COMPLETED' }));
    expect(overview.days[0].summary).toBe('8 appointments · all done');
    expect(overview.days[0].tone).toBe('done');
  });

  it('uses singular long form for a single completed appointment', () => {
    const overview = build([makeAppointment(MONDAY, { status: 'COMPLETED' })]);
    expect(overview.days[0].summary).toBe('1 appointment · all done');
  });

  it('does not call an empty day "all done"', () => {
    expect(monday().tone).toBe('normal');
  });

  it('appends the note after the compact count', () => {
    const overview = build(makeMany(TUESDAY, 14), {
      [toDateKey(TUESDAY)]: { note: 'OR block am' },
    });
    expect(overview.days[1].summary).toBe('14 appts · OR block am');
  });

  it('shows only the note on a day with no appointments', () => {
    const overview = build([], {
      [toDateKey(MONDAY)]: { note: 'Open clinic 09:00–13:00 · walk-ins' },
    });
    expect(overview.days[0].summary).toBe('Open clinic 09:00–13:00 · walk-ins');
  });

  it('ignores a note that is only whitespace', () => {
    const overview = build([], { [toDateKey(MONDAY)]: { note: '   ' } });
    expect(overview.days[0].summary).toBe('No appointments');
  });

  it('surfaces pending requests when there is no note', () => {
    const overview = build([
      ...makeMany(MONDAY, 8),
      ...makeMany(MONDAY, 1, { status: 'REQUESTED' }),
    ]);
    expect(overview.days[0].summary).toBe('9 appts · 1 request to approve');
  });

  it('pluralises multiple pending requests', () => {
    const overview = build([
      ...makeMany(MONDAY, 5),
      ...makeMany(MONDAY, 3, { status: 'REQUESTED' }),
    ]);
    expect(overview.days[0].summary).toBe('8 appts · 3 requests to approve');
  });

  it('lets an explicit note win over the requests clause', () => {
    const overview = build(
      [...makeMany(MONDAY, 5), ...makeMany(MONDAY, 2, { status: 'REQUESTED' })],
      {
        [toDateKey(MONDAY)]: { note: 'dental OR morning' },
      }
    );
    expect(overview.days[0].summary).toBe('7 appts · dental OR morning');
  });

  it('names a single vet who is off and flags remaining room', () => {
    const overview = build(makeMany(MONDAY, 6), {
      [toDateKey(MONDAY)]: { vetsOff: ['Dr. Keller'], hasRoomToBook: true },
    });
    expect(overview.days[0].summary).toBe('6 appts · Dr. Keller off · room to book');
  });

  it('counts vets instead of naming them when more than one is off', () => {
    const overview = build(makeMany(MONDAY, 6), {
      [toDateKey(MONDAY)]: { vetsOff: ['Dr. Keller', 'Dr. Ruiz'] },
    });
    expect(overview.days[0].summary).toBe('6 appts · 2 vets off');
  });

  it('adds no clause for an empty vetsOff list', () => {
    const overview = build(makeMany(MONDAY, 6), { [toDateKey(MONDAY)]: { vetsOff: [] } });
    expect(overview.days[0].summary).toBe('6 appts');
  });

  it('stacks note, vets off and room to book in order', () => {
    const overview = build(makeMany(MONDAY, 6), {
      [toDateKey(MONDAY)]: {
        note: 'OR block am',
        vetsOff: ['Dr. Keller'],
        hasRoomToBook: true,
      },
    });
    expect(overview.days[0].summary).toBe('6 appts · OR block am · Dr. Keller off · room to book');
  });
});

describe('buildPhoneWeekOverview — emergency flag', () => {
  it('carries no flag when nothing is urgent', () => {
    expect(build(makeMany(MONDAY, 4)).days[0].flag).toBeNull();
  });

  it('flags a single open emergency', () => {
    const overview = build([
      ...makeMany(MONDAY, 13),
      makeAppointment(MONDAY, { isEmergency: true }),
    ]);
    expect(overview.days[0].flag).toBe('1 EMERGENCY');
  });

  it('pluralises multiple open emergencies', () => {
    const overview = build(makeMany(MONDAY, 2, { isEmergency: true }));
    expect(overview.days[0].flag).toBe('2 EMERGENCIES');
  });

  it('stops flagging an emergency once it is completed', () => {
    const overview = build([makeAppointment(MONDAY, { isEmergency: true, status: 'COMPLETED' })]);
    expect(overview.days[0].flag).toBeNull();
    expect(overview.days[0].summary).toBe('1 appointment · all done');
    expect(overview.days[0].tone).toBe('done');
  });

  it('does not flag a cancelled emergency', () => {
    const overview = build([makeAppointment(MONDAY, { isEmergency: true, status: 'CANCELLED' })]);
    expect(overview.days[0].flag).toBeNull();
    expect(overview.days[0].appointmentCount).toBe(0);
  });
});

describe('buildPhoneWeekOverview — load bar segments', () => {
  it('excludes cancellations and no-shows from the count and the bar', () => {
    const overview = build([
      ...makeMany(MONDAY, 2),
      makeAppointment(MONDAY, { status: 'CANCELLED' }),
      makeAppointment(MONDAY, { status: 'NO_SHOW' }),
    ]);
    const day = overview.days[0];
    expect(day.appointmentCount).toBe(2);
    expect(day.summary).toBe('2 appts');
    expect(day.segments).toHaveLength(1);
    expect(day.segments[0].count).toBe(2);
  });

  it('scales a single band by count over capacity', () => {
    const overview = build(makeMany(MONDAY, 5, { status: 'COMPLETED' }), undefined, 10);
    expect(overview.days[0].segments).toEqual([
      {
        kind: 'completed',
        count: 5,
        widthPercent: 50,
        color: SEGMENT_COLORS.completed,
      },
    ]);
  });

  it('orders bands completed, in progress, emergency, upcoming, requested, walk-in', () => {
    const overview = build(
      [
        ...makeMany(MONDAY, 2, { status: 'REQUESTED' }),
        ...makeMany(MONDAY, 2, { status: 'UPCOMING' }),
        ...makeMany(MONDAY, 2, { isEmergency: true }),
        ...makeMany(MONDAY, 2, { status: 'IN_PROGRESS' }),
        ...makeMany(MONDAY, 2, { status: 'COMPLETED' }),
      ],
      { [toDateKey(MONDAY)]: { walkInCount: 2 } },
      12
    );
    expect(overview.days[0].segments.map((segment) => segment.kind)).toEqual([
      'completed',
      'inProgress',
      'emergency',
      'upcoming',
      'requested',
      'walkIn',
    ]);
  });

  it('folds checked-in appointments into the in-progress band', () => {
    const overview = build(
      [
        makeAppointment(MONDAY, { status: 'CHECKED_IN' }),
        makeAppointment(MONDAY, { status: 'IN_PROGRESS' }),
      ],
      undefined,
      10
    );
    expect(overview.days[0].segments).toEqual([
      { kind: 'inProgress', count: 2, widthPercent: 20, color: SEGMENT_COLORS.inProgress },
    ]);
  });

  it('pulls an open emergency out of its status band into the red band', () => {
    const overview = build(
      [makeAppointment(MONDAY, { status: 'UPCOMING', isEmergency: true }), makeAppointment(MONDAY)],
      undefined,
      10
    );
    const kinds = overview.days[0].segments.map((segment) => segment.kind);
    expect(kinds).toEqual(['emergency', 'upcoming']);
  });

  it('counts a completed emergency as done, not as an emergency', () => {
    const overview = build(
      [makeAppointment(MONDAY, { status: 'COMPLETED', isEmergency: true })],
      undefined,
      10
    );
    expect(overview.days[0].segments.map((segment) => segment.kind)).toEqual(['completed']);
  });

  it('omits bands with no appointments', () => {
    const overview = build(makeMany(MONDAY, 3), undefined, 10);
    expect(overview.days[0].segments).toHaveLength(1);
  });

  it('renders a walk-in band on a day with no appointments', () => {
    const overview = build(
      [],
      { [toDateKey(MONDAY)]: { walkInCount: 5, note: 'Open clinic 09:00–13:00 · walk-ins' } },
      20
    );
    const day = overview.days[0];
    expect(day.appointmentCount).toBe(0);
    expect(day.summary).toBe('Open clinic 09:00–13:00 · walk-ins');
    expect(day.segments).toEqual([
      { kind: 'walkIn', count: 5, widthPercent: 25, color: SEGMENT_COLORS.walkIn },
    ]);
  });

  it('rounds a count that does not divide evenly to one decimal', () => {
    // 1/3 of the track — 33.333…% rounds to 33.3%.
    const overview = build(makeMany(MONDAY, 1), undefined, 3);
    expect(overview.days[0].segments[0].widthPercent).toBe(33.3);
  });

  it('keeps uneven bands summing to no more than the whole track', () => {
    const overview = build(
      [...makeMany(MONDAY, 1, { status: 'COMPLETED' }), ...makeMany(MONDAY, 1)],
      undefined,
      7
    );
    const total = overview.days[0].segments.reduce((sum, segment) => sum + segment.widthPercent, 0);
    expect(total).toBeCloseTo(28.6, 1);
    expect(total).toBeLessThan(100);
  });

  it('leaves free room in the track for an under-booked day', () => {
    const overview = build(makeMany(MONDAY, 4), undefined, 16);
    expect(overview.days[0].segments[0].widthPercent).toBe(25);
  });

  it('clamps an overbooked day to exactly the full track', () => {
    const overview = build(
      [...makeMany(MONDAY, 10, { status: 'COMPLETED' }), ...makeMany(MONDAY, 10)],
      undefined,
      10
    );
    const segments = overview.days[0].segments;
    const total = segments.reduce((sum, segment) => sum + segment.widthPercent, 0);
    expect(total).toBe(100);
    expect(segments.every((segment) => segment.widthPercent === 50)).toBe(true);
    // The counts still tell the truth even though the widths were scaled.
    expect(overview.days[0].appointmentCount).toBe(20);
  });

  it('drops the bands entirely when a day has no capacity', () => {
    const overview = build(makeMany(MONDAY, 3), { [toDateKey(MONDAY)]: { capacity: 0 } });
    expect(overview.days[0].segments).toEqual([]);
    expect(overview.days[0].appointmentCount).toBe(3);
  });

  it('lets a per-day capacity override the default', () => {
    const overview = build(makeMany(MONDAY, 5), { [toDateKey(MONDAY)]: { capacity: 5 } }, 20);
    expect(overview.days[0].segments[0].widthPercent).toBe(100);
  });

  it('falls back to the default capacity when none is supplied', () => {
    const overview = build(makeMany(MONDAY, DEFAULT_DAY_CAPACITY));
    expect(overview.days[0].segments[0].widthPercent).toBe(100);
  });

  it('gives every day equal bars when the week is evenly loaded', () => {
    const overview = build(
      getWeekDates(WEEK_START).flatMap((date) => makeMany(date, 4)),
      undefined,
      8
    );
    overview.days.forEach((day) => {
      expect(day.appointmentCount).toBe(4);
      expect(day.segments[0].widthPercent).toBe(50);
    });
    expect(overview.totalAppointments).toBe(28);
  });

  it('loads one day and leaves the rest empty', () => {
    const overview = build(makeMany(TUESDAY, 6), undefined, 12);
    expect(overview.days[1].segments[0].widthPercent).toBe(50);
    overview.days
      .filter((_, index) => index !== 1)
      .forEach((day) => {
        expect(day.appointmentCount).toBe(0);
        expect(day.segments).toEqual([]);
      });
  });

  it('colours every band from a design token', () => {
    Object.values(SEGMENT_COLORS).forEach((color) => {
      expect(color).toMatch(/^var\(--/);
    });
  });
});

describe('buildPhoneWeekOverview — clinic timezone bucketing', () => {
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
   * A zone at least six hours west of whatever zone the test host runs in, so
   * the divergence this test relies on exists on a UTC CI box and on a
   * developer's laptop alike.
   */
  const pickZoneWestOfHost = (reference: Date): string => {
    const hostOffset = -reference.getTimezoneOffset();
    const zone = CANDIDATE_ZONES.find(
      (candidate) => zoneOffsetMinutes(candidate, reference) <= hostOffset - 360
    );
    if (!zone) throw new Error('No candidate timezone is far enough west of the test host.');
    return zone;
  };

  const withInstant = (appointment: Appointment, instant: Date): Appointment => ({
    ...appointment,
    appointmentDate: instant,
    startTime: instant,
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('buckets by the clinic calendar day, not the browser local day', () => {
    const zone = pickZoneWestOfHost(MONDAY);
    expect(setPreferredTimeZone(zone)).toBe(true);

    // 00:30 on the local Monday is still the Sunday evening at the clinic, so it
    // belongs to no row in this week...
    const stillSundayAtTheClinic = withInstant(makeAppointment(MONDAY), atLocalTime(MONDAY, 0, 30));
    // ...while 23:30 on the local Monday is comfortably inside the clinic's Monday.
    const mondayAtTheClinic = withInstant(makeAppointment(MONDAY), atLocalTime(MONDAY, 23, 30));

    const overview = build([stillSundayAtTheClinic, mondayAtTheClinic]);

    expect(overview.days[0].appointmentCount).toBe(1);
    expect(overview.days[0].segments[0].count).toBe(1);
    expect(overview.totalAppointments).toBe(1);
  });
});
