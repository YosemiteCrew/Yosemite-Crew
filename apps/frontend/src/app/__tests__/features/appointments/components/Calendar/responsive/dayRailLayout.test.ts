import type { Appointment } from '@yosemite-crew/types';

import {
  buildDayRailLayout,
  formatRailTime,
  minutesToPct,
  DEFAULT_FOLD_UNITS,
  type DayRailWindow,
} from '@/app/features/appointments/components/Calendar/responsive/dayRailLayout';

const DAY = '2026-07-07';

const at = (time: string): Date => new Date(`${DAY}T${time}:00`);

let idCounter = 0;

const makeAppointment = (
  start: string,
  end: string,
  overrides: Partial<Appointment> = {}
): Appointment => {
  idCounter += 1;
  return {
    id: `appt-${idCounter}`,
    patient: {
      id: `pet-${idCounter}`,
      name: 'Poppy',
      species: 'Dog',
      parent: { id: `parent-${idCounter}`, name: 'Lena Hartmann' },
    },
    organisationId: 'org-1',
    appointmentDate: at('00:00'),
    startTime: at(start),
    endTime: at(end),
    timeSlot: `${start}-${end}`,
    durationMinutes: 0,
    status: 'UPCOMING',
    ...overrides,
  };
};

const WINDOW: DayRailWindow = { startHour: 8, endHour: 16 };

const build = (appointments: Appointment[], dayWindow: DayRailWindow = WINDOW, options = {}) =>
  buildDayRailLayout({ appointments, dayWindow, ...options });

describe('formatRailTime', () => {
  it.each([
    [0, '00:00'],
    [8 * 60, '08:00'],
    [8 * 60 + 30, '08:30'],
    [14 * 60 + 5, '14:05'],
    [23 * 60 + 59, '23:59'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatRailTime(minutes)).toBe(expected);
  });

  it('rounds fractional minutes', () => {
    expect(formatRailTime(8 * 60 + 29.6)).toBe('08:30');
  });
});

describe('buildDayRailLayout — invalid windows', () => {
  it.each([
    ['end before start', { startHour: 16, endHour: 8 }],
    ['zero length', { startHour: 8, endHour: 8 }],
    ['a non-finite start', { startHour: Number.NaN, endHour: 16 }],
    ['a non-finite end', { startHour: 8, endHour: Number.POSITIVE_INFINITY }],
  ])('returns an empty layout for %s', (_name, dayWindow) => {
    const layout = build([], dayWindow as DayRailWindow);
    expect(layout.segments).toHaveLength(0);
    expect(layout.labels).toHaveLength(0);
    expect(layout.folds).toHaveLength(0);
    expect(layout.blocks).toHaveLength(0);
    expect(layout.totalUnits).toBe(0);
    expect(layout.dayWindow).toEqual({ startHour: 0, endHour: 0 });
  });

  it('snaps a fractional window out to whole hours', () => {
    const layout = build([makeAppointment('08:30', '09:30')], { startHour: 8.4, endHour: 9.2 });
    expect(layout.dayWindow).toEqual({ startHour: 8, endHour: 10 });
    expect(layout.segments).toHaveLength(2);
  });

  it('returns an empty layout when a fully folded day is given zero fold weight', () => {
    const layout = build([], WINDOW, { foldUnits: 0 });
    expect(layout.totalUnits).toBe(0);
    expect(layout.segments).toHaveLength(0);
    expect(layout.dayWindow).toEqual(WINDOW);
  });
});

describe('buildDayRailLayout — folding', () => {
  it('folds the entire day into one band when there are no appointments', () => {
    const layout = build([]);

    expect(layout.segments).toHaveLength(1);
    expect(layout.segments[0]).toMatchObject({
      kind: 'folded',
      startMinutes: 8 * 60,
      endMinutes: 16 * 60,
      topPct: 0,
      heightPct: 100,
    });
    expect(layout.folds).toHaveLength(1);
    expect(layout.folds[0].rangeLabel).toBe('08:00 to 16:00');
    expect(layout.labels.map((label) => label.label)).toEqual(['08:00', '16:00']);
    expect(layout.labels.every((label) => !label.hasLine)).toBe(true);
    expect(layout.totalUnits).toBe(DEFAULT_FOLD_UNITS);
  });

  it('folds nothing when every hour is busy and gives each hour an equal share', () => {
    const layout = build([makeAppointment('08:00', '16:00')]);

    expect(layout.folds).toHaveLength(0);
    expect(layout.segments).toHaveLength(8);
    expect(layout.segments.every((segment) => segment.kind === 'hour')).toBe(true);
    expect(layout.totalUnits).toBe(8);
    expect(layout.segments[0].heightPct).toBe(12.5);
    expect(layout.segments[1].topPct).toBe(12.5);
    expect(layout.blocks[0]).toMatchObject({ topPct: 0, heightPct: 100 });
  });

  it('folds a single mid-day gap and compresses it below one hour', () => {
    // 08-12 busy, 12-14 free, 14-16 busy — the design's shape.
    const layout = build([
      makeAppointment('08:30', '09:30', { status: 'CHECKED_IN' }),
      makeAppointment('09:45', '10:30'),
      makeAppointment('11:06', '11:54'),
      makeAppointment('14:00', '14:45'),
      makeAppointment('15:00', '16:00'),
    ]);

    expect(layout.folds).toHaveLength(1);
    expect(layout.folds[0]).toMatchObject({
      startMinutes: 12 * 60,
      endMinutes: 14 * 60,
      rangeLabel: '12:00 to 14:00',
    });

    // 6 unfolded hours + one folded run.
    expect(layout.totalUnits).toBe(6 + DEFAULT_FOLD_UNITS);

    const hourHeight = layout.segments[0].heightPct;
    const foldHeight = layout.folds[0].heightPct;
    // The defining behaviour: the folded 2-hour stretch is shorter than one hour.
    expect(foldHeight).toBeLessThan(hourHeight);
    expect(foldHeight / hourHeight).toBeCloseTo(DEFAULT_FOLD_UNITS, 3);

    // Labels: 13:00 is swallowed by the fold.
    expect(layout.labels.map((label) => label.label)).toEqual([
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
  });

  it('draws gridlines everywhere except the rail top and the fold edges', () => {
    // 08-10 busy, 10-14 free (folded), 14-16 busy.
    const layout = build([makeAppointment('08:30', '09:30'), makeAppointment('14:00', '15:30')]);
    expect(layout.folds[0].rangeLabel).toBe('10:00 to 14:00');

    const lines = Object.fromEntries(layout.labels.map((label) => [label.label, label.hasLine]));
    expect(lines['08:00']).toBe(false); // rail top
    expect(lines['09:00']).toBe(true);
    expect(lines['10:00']).toBe(false); // fold start
    expect(lines['14:00']).toBe(false); // fold end
    expect(lines['15:00']).toBe(true);
    expect(lines['16:00']).toBe(true);
  });

  it('folds multiple gaps independently', () => {
    const layout = build([
      makeAppointment('08:15', '08:45'),
      makeAppointment('11:00', '11:30'),
      makeAppointment('15:00', '15:30'),
    ]);

    expect(layout.folds.map((fold) => fold.rangeLabel)).toEqual([
      '09:00 to 11:00',
      '12:00 to 15:00',
    ]);
    expect(layout.totalUnits).toBe(3 + 2 * DEFAULT_FOLD_UNITS);
  });

  it('leaves a gap shorter than the fold threshold unfolded', () => {
    // Single free hour 09-10 stays a full-height hour.
    const layout = build([makeAppointment('08:15', '08:45'), makeAppointment('10:00', '16:00')]);

    expect(layout.folds).toHaveLength(0);
    expect(layout.segments).toHaveLength(8);
    expect(layout.totalUnits).toBe(8);
  });

  it('honours a custom minFoldHours threshold', () => {
    const appointments = [makeAppointment('08:15', '08:45'), makeAppointment('10:00', '16:00')];

    expect(build(appointments, WINDOW, { minFoldHours: 1 }).folds).toHaveLength(1);
    expect(build(appointments, WINDOW, { minFoldHours: 3 }).folds).toHaveLength(0);
  });

  it('honours a custom foldUnits weight', () => {
    const layout = build(
      [makeAppointment('08:00', '12:00'), makeAppointment('14:00', '16:00')],
      WINDOW,
      {
        foldUnits: 1,
      }
    );
    expect(layout.totalUnits).toBe(7);
    // With foldUnits === 1 the "folded" band is exactly one hour tall.
    expect(layout.folds[0].heightPct).toBeCloseTo(layout.segments[0].heightPct, 5);
  });

  it('forces an otherwise-empty run to stay unfolded when an appointment sits inside it', () => {
    const withoutGapWork = build([
      makeAppointment('08:00', '09:00'),
      makeAppointment('15:00', '16:00'),
    ]);
    expect(withoutGapWork.folds.map((f) => f.rangeLabel)).toEqual(['09:00 to 15:00']);

    // One 20-minute appointment lands at 12:10 — the run must break around it.
    const withGapWork = build([
      makeAppointment('08:00', '09:00'),
      makeAppointment('12:10', '12:30'),
      makeAppointment('15:00', '16:00'),
    ]);
    expect(withGapWork.folds.map((f) => f.rangeLabel)).toEqual([
      '09:00 to 12:00',
      '13:00 to 15:00',
    ]);
    // 12:00-13:00 is now a full-height hour.
    const noonSegment = withGapWork.segments.find((s) => s.startMinutes === 12 * 60);
    expect(noonSegment).toMatchObject({ kind: 'hour', units: 1 });
  });

  it('does not treat an appointment that merely touches an hour boundary as busy', () => {
    // Ends exactly at 09:00, so 09:00-10:00 is still free.
    const layout = build([makeAppointment('08:00', '09:00'), makeAppointment('11:00', '16:00')]);
    expect(layout.folds.map((f) => f.rangeLabel)).toEqual(['09:00 to 11:00']);
  });
});

describe('buildDayRailLayout — blocks', () => {
  it('positions a block proportionally inside its hour', () => {
    const layout = build([makeAppointment('08:30', '09:30'), makeAppointment('09:45', '16:00')]);

    const hourHeight = layout.segments[0].heightPct;
    expect(layout.blocks[0].topPct).toBeCloseTo(hourHeight / 2, 3);
    expect(layout.blocks[0].heightPct).toBeCloseTo(hourHeight, 3);
    expect(layout.blocks[0].timeLabel).toBe('08:30–09:30');
  });

  it('drops appointments entirely outside the window and clamps the ones that straddle it', () => {
    const layout = build([
      makeAppointment('06:00', '07:00'), // before
      makeAppointment('17:00', '18:00'), // after
      makeAppointment('07:30', '08:30'), // straddles the start
      makeAppointment('15:30', '16:30'), // straddles the end
    ]);

    expect(layout.blocks).toHaveLength(2);
    expect(layout.blocks[0]).toMatchObject({ startMinutes: 8 * 60, topPct: 0 });
    // The raw time label keeps the true booking times even when clamped.
    expect(layout.blocks[0].timeLabel).toBe('07:30–08:30');
    expect(layout.blocks[1].topPct + layout.blocks[1].heightPct).toBeCloseTo(100, 3);
  });

  it('treats an end that rolls past midnight as the end of the day', () => {
    const appointment = makeAppointment('15:00', '16:00');
    appointment.endTime = new Date('2026-07-08T01:00:00');
    const layout = build([appointment]);
    expect(layout.blocks[0]).toMatchObject({ startMinutes: 15 * 60, endMinutes: 16 * 60 });
  });

  it('keeps back-to-back appointments in a single lane', () => {
    const layout = build([
      makeAppointment('09:00', '10:00'),
      makeAppointment('10:00', '11:00'),
      makeAppointment('11:00', '12:00'),
    ]);
    expect(layout.blocks.map((b) => [b.laneIndex, b.laneCount])).toEqual([
      [0, 1],
      [0, 1],
      [0, 1],
    ]);
  });

  it('splits overlapping appointments into lanes', () => {
    const layout = build([
      makeAppointment('09:00', '10:30'),
      makeAppointment('09:30', '11:00'),
      makeAppointment('09:45', '10:15'),
      makeAppointment('13:00', '14:00'), // separate cluster
    ]);

    expect(layout.blocks.map((b) => b.laneIndex)).toEqual([0, 1, 2, 0]);
    expect(layout.blocks.map((b) => b.laneCount)).toEqual([3, 3, 3, 1]);
  });

  it('reuses a freed lane once an overlapping run releases it', () => {
    const layout = build([
      makeAppointment('09:00', '11:00'),
      makeAppointment('09:30', '10:00'),
      makeAppointment('10:15', '10:45'), // overlaps #1 only, so lane 1 is free again
    ]);
    expect(layout.blocks.map((b) => b.laneIndex)).toEqual([0, 1, 1]);
    expect(layout.blocks.map((b) => b.laneCount)).toEqual([2, 2, 2]);
  });

  it('orders same-start appointments by the shorter one first', () => {
    const long = makeAppointment('09:00', '11:00');
    const short = makeAppointment('09:00', '09:30');
    const layout = build([long, short]);

    expect(layout.blocks.map((b) => b.timeLabel)).toEqual(['09:00–09:30', '09:00–11:00']);
    expect(layout.blocks.map((b) => b.laneIndex)).toEqual([0, 1]);
  });

  it('falls back to an index key when the appointment has no id', () => {
    const appointment = makeAppointment('09:00', '10:00');
    delete appointment.id;
    expect(build([appointment]).blocks[0].key).toBe('appointment-0');
  });
});

describe('minutesToPct', () => {
  const layout = build([
    makeAppointment('08:30', '09:30'),
    makeAppointment('09:45', '10:30'),
    makeAppointment('11:06', '11:54'),
    makeAppointment('14:00', '14:45'),
    makeAppointment('15:00', '16:00'),
  ]);

  it('clamps outside the window', () => {
    expect(minutesToPct(layout, 6 * 60)).toBe(0);
    expect(minutesToPct(layout, 8 * 60)).toBe(0);
    expect(minutesToPct(layout, 20 * 60)).toBe(100);
    expect(minutesToPct(layout, 16 * 60)).toBe(100);
  });

  it('interpolates linearly inside an unfolded hour', () => {
    const hour = layout.segments[0].heightPct;
    expect(minutesToPct(layout, 10 * 60 + 20)).toBeCloseTo(2 * hour + hour / 3, 2);
  });

  it('interpolates across a folded run using the compressed height', () => {
    const fold = layout.folds[0];
    // 13:00 sits halfway through the folded 12:00-14:00 run.
    expect(minutesToPct(layout, 13 * 60)).toBeCloseTo(fold.topPct + fold.heightPct / 2, 2);
  });

  it('returns 0 for an empty layout', () => {
    expect(minutesToPct(build([], { startHour: 8, endHour: 8 }), 9 * 60)).toBe(0);
  });
});
