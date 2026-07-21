import type { Appointment } from '@yosemite-crew/types';
import type { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import {
  DAY_PEEK_LIMIT,
  LOAD_DOT_THRESHOLDS,
  MAX_LOAD_DOTS,
  buildPhoneMonthModel,
  getDaysInMonth,
  getIsoWeekNumber,
  getLoadDotCount,
  getMondayFirstWeekday,
  shiftMonthAnchor,
} from '@/app/features/appointments/components/Calendar/responsive/phoneMonthModel';
import {
  buildPreferredTimeZoneDayInstant,
  getDateKeyInPreferredTimeZone,
  setPreferredTimeZone,
} from '@/app/lib/timezone';

// The preferred timezone falls back to Europe/Berlin when localStorage is empty,
// which makes every assertion below independent of the host machine's zone.
beforeEach(() => {
  window.localStorage.clear();
});

type AppointmentOverrides = Partial<Appointment> & { startTime: Date };

let sequence = 0;

const makeAppointment = ({ startTime, ...overrides }: AppointmentOverrides): Appointment => {
  sequence += 1;
  return {
    id: `appt-${sequence}`,
    patient: {
      id: `pet-${sequence}`,
      name: 'Poppy',
      species: 'Dog',
      parent: { id: 'parent-1', name: 'Lena Hartmann' },
    },
    organisationId: 'org-1',
    appointmentDate: startTime,
    startTime,
    endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
    timeSlot: '08:30',
    durationMinutes: 30,
    status: 'UPCOMING' as AppointmentStatus,
    ...overrides,
  };
};

/** n appointments on a given Berlin calendar day (10:00 Berlin = 08:00 UTC in July). */
const appointmentsOn = (
  year: number,
  month: number,
  day: number,
  count: number,
  overrides: Partial<Appointment> = {}
): Appointment[] =>
  Array.from({ length: count }, (_, index) =>
    makeAppointment({
      startTime: new Date(Date.UTC(year, month - 1, day, 8, index)),
      ...overrides,
    })
  );

const JULY_2026 = new Date(Date.UTC(2026, 6, 15, 12));
const TODAY = new Date(Date.UTC(2026, 6, 7, 8)); // Tue 7 Jul 2026, 10:00 Berlin

const cellFor = (model: ReturnType<typeof buildPhoneMonthModel>, dateKey: string) =>
  model.weeks.flatMap((week) => week.cells).find((cell) => cell.dateKey === dateKey);

describe('buildPhoneMonthModel — cell dateKey round-trips in extreme forward zones', () => {
  it('a UTC+12/+13 zone keeps the selected day (dateKey resolves to its own instant)', () => {
    // Selecting a day builds currentDate on demand from cell.dateKey (as PhoneCalendar does), which
    // is then re-read via the preferred timezone. In Pacific/Auckland a UTC-noon anchor resolved to
    // the NEXT calendar day, so clicking 7 Jul silently selected 8 Jul. The key must round-trip.
    setPreferredTimeZone('Pacific/Auckland');
    const model = buildPhoneMonthModel({ monthDate: JULY_2026, appointments: [], today: TODAY });
    const cell = cellFor(model, '2026-07-07');
    expect(cell).toBeDefined();
    const [year, month, day] = cell!.dateKey.split('-').map(Number);
    const selected = buildPreferredTimeZoneDayInstant(year, month, day);
    expect(getDateKeyInPreferredTimeZone(selected)).toBe('2026-07-07');
  });
});

describe('getLoadDotCount', () => {
  it('renders no dots for an empty day', () => {
    expect(getLoadDotCount(0)).toBe(0);
  });

  it('never returns dots for nonsensical counts', () => {
    expect(getLoadDotCount(-3)).toBe(0);
    expect(getLoadDotCount(Number.NaN)).toBe(0);
  });

  it('maps the first band to a single dot', () => {
    expect(getLoadDotCount(1)).toBe(1);
    expect(getLoadDotCount(LOAD_DOT_THRESHOLDS[0])).toBe(1);
  });

  it('maps the second band to two dots', () => {
    expect(getLoadDotCount(LOAD_DOT_THRESHOLDS[0] + 1)).toBe(2);
    expect(getLoadDotCount(LOAD_DOT_THRESHOLDS[1])).toBe(2);
  });

  it('saturates at the cap for anything heavier', () => {
    expect(getLoadDotCount(LOAD_DOT_THRESHOLDS[1] + 1)).toBe(MAX_LOAD_DOTS);
    expect(getLoadDotCount(14)).toBe(MAX_LOAD_DOTS);
    expect(getLoadDotCount(9999)).toBe(MAX_LOAD_DOTS);
  });

  it('matches the design reference loads', () => {
    // From the design: Mon 8 appts, Tue 14, Wed 9, Thu 11, Fri 6.
    expect([8, 14, 9, 11, 6].map(getLoadDotCount)).toEqual([2, 3, 2, 3, 1]);
  });
});

describe('calendar arithmetic', () => {
  it('indexes weekdays Monday-first', () => {
    expect(getMondayFirstWeekday(2026, 7, 6)).toBe(0); // Monday
    expect(getMondayFirstWeekday(2026, 7, 12)).toBe(6); // Sunday
  });

  it('counts days per month, including a leap February', () => {
    expect(getDaysInMonth(2026, 7)).toBe(31);
    expect(getDaysInMonth(2026, 6)).toBe(30);
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2000, 2)).toBe(29);
    expect(getDaysInMonth(1900, 2)).toBe(28);
  });

  it('computes ISO week numbers', () => {
    expect(getIsoWeekNumber(2026, 7, 6)).toBe(28); // the design's "Week 28"
    expect(getIsoWeekNumber(2026, 7, 12)).toBe(28); // Sunday still closes week 28
    expect(getIsoWeekNumber(2026, 7, 13)).toBe(29);
  });

  it('handles ISO year boundaries', () => {
    expect(getIsoWeekNumber(2026, 1, 1)).toBe(1); // Thursday -> week 1
    expect(getIsoWeekNumber(2027, 1, 1)).toBe(53); // Friday -> belongs to 2026 W53
    expect(getIsoWeekNumber(2023, 1, 1)).toBe(52); // Sunday -> belongs to 2022 W52
  });
});

describe('buildPhoneMonthModel — grid construction', () => {
  const emptyModel = (monthDate: Date) =>
    buildPhoneMonthModel({ monthDate, appointments: [], today: TODAY });

  it('pads July 2026 with the design leading and trailing days', () => {
    const model = emptyModel(JULY_2026);
    const cells = model.weeks.flatMap((week) => week.cells);

    expect(model.weeks).toHaveLength(5);
    expect(cells).toHaveLength(35);
    // Design shows 29, 30, then 1, 2 ... 31, then 1, 2.
    expect(cells.slice(0, 4).map((cell) => cell.dayOfMonth)).toEqual([29, 30, 1, 2]);
    expect(cells.slice(-2).map((cell) => cell.dayOfMonth)).toEqual([1, 2]);
    expect(cells[0]).toMatchObject({ dateKey: '2026-06-29', isOutsideMonth: true });
    expect(cells[2]).toMatchObject({ dateKey: '2026-07-01', isOutsideMonth: false });
    expect(cells[34]).toMatchObject({ dateKey: '2026-08-02', isOutsideMonth: true });
  });

  it('labels the month', () => {
    const model = emptyModel(JULY_2026);
    expect(model.monthLabel).toBe('July 2026');
    expect(model.monthTitle).toBe('July');
    expect(model.year).toBe(2026);
    expect(model.month).toBe(7);
  });

  it('needs no padding for a 28-day February starting on a Monday', () => {
    const model = emptyModel(new Date(Date.UTC(2021, 1, 15, 12)));
    const cells = model.weeks.flatMap((week) => week.cells);

    expect(model.weeks).toHaveLength(4);
    expect(cells).toHaveLength(28);
    expect(cells.every((cell) => !cell.isOutsideMonth)).toBe(true);
    expect(cells[0].dateKey).toBe('2021-02-01');
    expect(cells[27].dateKey).toBe('2021-02-28');
  });

  it('gives a Sunday-starting month six leading days', () => {
    const model = emptyModel(new Date(Date.UTC(2026, 1, 15, 12))); // Feb 2026 starts Sunday
    const cells = model.weeks.flatMap((week) => week.cells);

    expect(cells).toHaveLength(35);
    expect(cells.filter((cell) => cell.isOutsideMonth && cell.dateKey < '2026-02-01')).toHaveLength(
      6
    );
    expect(cells[0].dateKey).toBe('2026-01-26');
    expect(cells[6].dateKey).toBe('2026-02-01');
  });

  it('fits a leap February', () => {
    const model = emptyModel(new Date(Date.UTC(2024, 1, 15, 12))); // Feb 2024, 29 days, starts Thu
    const cells = model.weeks.flatMap((week) => week.cells);
    const inMonth = cells.filter((cell) => !cell.isOutsideMonth);

    expect(cells).toHaveLength(35);
    expect(inMonth).toHaveLength(29);
    expect(inMonth[28].dateKey).toBe('2024-02-29');
  });

  it('fits a 30-day month starting on a Monday', () => {
    const model = emptyModel(new Date(Date.UTC(2026, 5, 15, 12))); // June 2026 starts Monday
    const cells = model.weeks.flatMap((week) => week.cells);

    expect(cells).toHaveLength(35);
    expect(cells[0].dateKey).toBe('2026-06-01');
    expect(cells[0].isOutsideMonth).toBe(false);
    expect(cells.filter((cell) => cell.isOutsideMonth)).toHaveLength(5);
  });

  it('aligns every row to a Monday and one ISO week', () => {
    const model = emptyModel(JULY_2026);
    model.weeks.forEach((week) => {
      expect(week.cells).toHaveLength(7);
      const [year, month, day] = week.cells[0].dateKey.split('-').map(Number);
      expect(getMondayFirstWeekday(year, month, day)).toBe(0);
    });
    expect(model.weeks.map((week) => week.isoWeek)).toEqual([27, 28, 29, 30, 31]);
  });

  it('marks today, past and future cells', () => {
    const model = emptyModel(JULY_2026);

    expect(cellFor(model, '2026-07-07')).toMatchObject({ isToday: true, isPast: false });
    expect(cellFor(model, '2026-07-06')).toMatchObject({ isToday: false, isPast: true });
    expect(cellFor(model, '2026-07-08')).toMatchObject({ isToday: false, isPast: false });
  });
});

describe('buildPhoneMonthModel — load and dots', () => {
  it('buckets appointments onto their day and derives dots', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: [...appointmentsOn(2026, 7, 1, 8), ...appointmentsOn(2026, 7, 2, 14)],
    });

    expect(cellFor(model, '2026-07-01')).toMatchObject({ appointmentCount: 8, dotCount: 2 });
    expect(cellFor(model, '2026-07-02')).toMatchObject({ appointmentCount: 14, dotCount: 3 });
  });

  it('leaves empty days with no load', () => {
    const model = buildPhoneMonthModel({ monthDate: JULY_2026, today: TODAY, appointments: [] });
    expect(cellFor(model, '2026-07-05')).toMatchObject({
      appointmentCount: 0,
      dotCount: 0,
      hasEmergency: false,
    });
  });

  it('caps a day far above the dot cap', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: appointmentsOn(2026, 7, 9, 80),
    });
    expect(cellFor(model, '2026-07-09')).toMatchObject({ appointmentCount: 80, dotCount: 3 });
  });

  it('flags a day holding an emergency', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: [
        ...appointmentsOn(2026, 7, 7, 2),
        ...appointmentsOn(2026, 7, 7, 1, { isEmergency: true }),
        ...appointmentsOn(2026, 7, 8, 1),
      ],
    });

    expect(cellFor(model, '2026-07-07')).toMatchObject({ dotCount: 1, hasEmergency: true });
    expect(cellFor(model, '2026-07-08')?.hasEmergency).toBe(false);
  });

  it('keeps padding cells inert even if appointments fall on them', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: appointmentsOn(2026, 6, 29, 5), // a leading padding day
    });

    expect(cellFor(model, '2026-06-29')).toMatchObject({
      isOutsideMonth: true,
      appointmentCount: 0,
      dotCount: 0,
    });
    expect(model.totalAppointments).toBe(0);
  });

  it('buckets by the preferred timezone, not the raw UTC day', () => {
    // 22:30 UTC on 7 Jul is 00:30 on 8 Jul in Berlin (CEST, +2).
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: [makeAppointment({ startTime: new Date(Date.UTC(2026, 6, 7, 22, 30)) })],
    });

    expect(cellFor(model, '2026-07-07')?.appointmentCount).toBe(0);
    expect(cellFor(model, '2026-07-08')?.appointmentCount).toBe(1);
  });
});

describe('buildPhoneMonthModel — summary and busiest week', () => {
  it('totals only in-month load and names the busiest ISO week', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: [
        ...appointmentsOn(2026, 7, 1, 3), // week 27
        ...appointmentsOn(2026, 7, 7, 14), // week 28
        ...appointmentsOn(2026, 7, 8, 9), // week 28
        ...appointmentsOn(2026, 7, 14, 4), // week 29
      ],
    });

    expect(model.totalAppointments).toBe(30);
    expect(model.busiestWeek).toBe(28);
    expect(model.summaryLabel).toBe('30 appointments · busiest week: 28');
    expect(model.weeks.find((week) => week.isoWeek === 28)?.appointmentCount).toBe(23);
  });

  it('breaks a busiest-week tie towards the earlier week', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: [...appointmentsOn(2026, 7, 1, 5), ...appointmentsOn(2026, 7, 8, 5)],
    });
    expect(model.busiestWeek).toBe(27);
  });

  it('has no busiest week when the month is empty', () => {
    const model = buildPhoneMonthModel({ monthDate: JULY_2026, today: TODAY, appointments: [] });
    expect(model.busiestWeek).toBeNull();
    expect(model.totalAppointments).toBe(0);
    expect(model.summaryLabel).toBe('No appointments');
  });

  it('says appointment in the singular', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: appointmentsOn(2026, 7, 3, 1),
    });
    expect(model.summaryLabel).toBe('1 appointment · busiest week: 27');
  });
});

describe('buildPhoneMonthModel — day peek', () => {
  const selected = new Date(Date.UTC(2026, 6, 7, 8));

  it('has no peek without a selection', () => {
    const model = buildPhoneMonthModel({ monthDate: JULY_2026, today: TODAY, appointments: [] });
    expect(model.peek).toBeNull();
  });

  it('marks the selected cell', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: [],
      selectedDate: selected,
    });
    expect(cellFor(model, '2026-07-07')?.isSelected).toBe(true);
    expect(cellFor(model, '2026-07-08')?.isSelected).toBe(false);
  });

  it('has no peek when the selection sits outside the grid', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      appointments: [],
      selectedDate: new Date(Date.UTC(2026, 10, 3, 8)),
    });
    expect(model.peek).toBeNull();
  });

  it('lists the day, sorted, capped, with the remainder counted', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      selectedDate: selected,
      appointments: [
        makeAppointment({ startTime: new Date(Date.UTC(2026, 6, 7, 12, 0)) }), // 14:00 Berlin
        makeAppointment({ startTime: new Date(Date.UTC(2026, 6, 7, 6, 30)) }), // 08:30 Berlin
        makeAppointment({ startTime: new Date(Date.UTC(2026, 6, 7, 7, 0)) }), // 09:00 Berlin
        makeAppointment({ startTime: new Date(Date.UTC(2026, 6, 7, 8, 48)) }), // 10:48 Berlin
      ],
    });

    expect(model.peek?.label).toBe('Tue 7 · 4 appointments');
    expect(model.peek?.appointmentCount).toBe(4);
    expect(model.peek?.items).toHaveLength(DAY_PEEK_LIMIT);
    expect(model.peek?.items.map((item) => item.time)).toEqual(['08:30', '09:00', '10:48']);
    expect(model.peek?.hiddenCount).toBe(1);
  });

  it('does not count a remainder when the day fits', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      selectedDate: selected,
      appointments: appointmentsOn(2026, 7, 7, 2),
    });
    expect(model.peek?.hiddenCount).toBe(0);
    expect(model.peek?.items).toHaveLength(2);
    expect(model.peek?.label).toBe('Tue 7 · 2 appointments');
  });

  it('renders an empty selected day', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      selectedDate: new Date(Date.UTC(2026, 6, 5, 8)),
      appointments: [],
    });
    expect(model.peek).toMatchObject({
      dateKey: '2026-07-05',
      label: 'Sun 5 · 0 appointments',
      appointmentCount: 0,
      items: [],
      hiddenCount: 0,
    });
  });

  it('shows no load for a selected padding day', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      selectedDate: new Date(Date.UTC(2026, 5, 29, 8)),
      appointments: appointmentsOn(2026, 6, 29, 4),
    });
    expect(model.peek).toMatchObject({ dateKey: '2026-06-29', appointmentCount: 0, items: [] });
  });

  it('builds a peek item from the appointment', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      selectedDate: selected,
      appointments: [
        makeAppointment({
          startTime: new Date(Date.UTC(2026, 6, 7, 6, 30)),
          status: 'CHECKED_IN',
          lead: { id: 'vet-1', name: 'Dr. Weber' },
          room: { id: 'room-1', name: 'Rm 1' },
          appointmentType: {
            id: 'type-1',
            name: 'annual check-up',
            speciality: { id: 'spec-1', name: 'General' },
          },
        }),
      ],
    });

    expect(model.peek?.items[0]).toMatchObject({
      time: '08:30',
      title: 'Poppy · annual check-up',
      subtitle: 'Dr. Weber · Rm 1',
      status: 'CHECKED_IN',
      statusLabel: 'CHECKED-IN',
      isEmergency: false,
    });
  });

  it('falls back to the concern, and to the pet name alone', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      selectedDate: selected,
      appointments: [
        makeAppointment({
          startTime: new Date(Date.UTC(2026, 6, 7, 6, 30)),
          concern: 'suspected toxicity',
        }),
        makeAppointment({ startTime: new Date(Date.UTC(2026, 6, 7, 7, 0)) }),
      ],
    });

    expect(model.peek?.items[0].title).toBe('Poppy · suspected toxicity');
    expect(model.peek?.items[1].title).toBe('Poppy');
    expect(model.peek?.items[1].subtitle).toBe('');
  });

  it('marks emergencies', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      selectedDate: selected,
      appointments: appointmentsOn(2026, 7, 7, 1, { isEmergency: true, status: 'IN_PROGRESS' }),
    });
    expect(model.peek?.items[0]).toMatchObject({
      isEmergency: true,
      statusLabel: 'IN PROGRESS',
    });
  });

  it('maps every status to plain-language copy', () => {
    const statuses: AppointmentStatus[] = [
      'REQUESTED',
      'UPCOMING',
      'CHECKED_IN',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ];

    const labels = statuses.map((status) => {
      const model = buildPhoneMonthModel({
        monthDate: JULY_2026,
        today: TODAY,
        selectedDate: selected,
        appointments: appointmentsOn(2026, 7, 7, 1, { status }),
      });
      return model.peek?.items[0].statusLabel;
    });

    expect(labels).toEqual([
      'REQUESTED',
      'UPCOMING',
      'CHECKED-IN',
      'IN PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NO SHOW',
    ]);
    expect(labels.some((label) => label?.includes('_'))).toBe(false);
  });

  it('synthesises an id for an appointment without one', () => {
    const model = buildPhoneMonthModel({
      monthDate: JULY_2026,
      today: TODAY,
      selectedDate: selected,
      appointments: [
        makeAppointment({ startTime: new Date(Date.UTC(2026, 6, 7, 6, 30)), id: undefined }),
      ],
    });
    expect(model.peek?.items[0].id).toBe('2026-07-07-0');
  });
});

describe('shiftMonthAnchor', () => {
  it('steps to the neighbouring months', () => {
    expect(shiftMonthAnchor(JULY_2026, -1).toISOString()).toBe('2026-06-15T12:00:00.000Z');
    expect(shiftMonthAnchor(JULY_2026, 1).toISOString()).toBe('2026-08-15T12:00:00.000Z');
  });

  it('rolls across the year boundary', () => {
    const december = new Date(Date.UTC(2026, 11, 15, 12));
    expect(shiftMonthAnchor(december, 1).toISOString()).toBe('2027-01-15T12:00:00.000Z');
    expect(shiftMonthAnchor(new Date(Date.UTC(2026, 0, 15, 12)), -1).toISOString()).toBe(
      '2025-12-15T12:00:00.000Z'
    );
  });

  it('produces an anchor that resolves back to the intended month', () => {
    const next = shiftMonthAnchor(JULY_2026, 1);
    const model = buildPhoneMonthModel({ monthDate: next, appointments: [], today: TODAY });
    expect(model.monthLabel).toBe('August 2026');
  });
});
