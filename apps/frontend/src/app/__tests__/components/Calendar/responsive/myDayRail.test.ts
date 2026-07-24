import type { Appointment } from '@yosemite-crew/types';
import type { Task } from '@/app/features/tasks/types/task';
import {
  buildAppointmentSubtitle,
  buildAppointmentTitle,
  buildMyDayRail,
  buildMyDaySummaryChips,
  buildRoundHeading,
  buildTaskSubtitle,
  countDueRoundItems,
  formatRailTime,
  isSameCalendarDay,
  toRailDate,
  type MyDayAppointmentEntry,
  type MyDayRound,
} from '@/app/features/appointments/components/Calendar/responsive/myDayRail';

const NOW = new Date(2026, 6, 7, 10, 20);
const at = (hours: number, minutes = 0) => new Date(2026, 6, 7, hours, minutes);

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appt-1',
  patient: {
    id: 'pet-1',
    name: 'Pretzel',
    species: 'dog',
    parent: { id: 'parent-1', name: 'Lena Fischer' },
  },
  organisationId: 'org-1',
  appointmentDate: at(9, 45),
  startTime: at(9, 45),
  timeSlot: '09:45',
  durationMinutes: 30,
  endTime: at(10, 15),
  status: 'UPCOMING',
  ...overrides,
});

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  _id: 'task-1',
  assignedTo: 'vet-1',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'CARE',
  name: 'Call Lena · cytology results',
  dueAt: at(13),
  status: 'PENDING',
  ...overrides,
});

const makeRound = (overrides: Partial<MyDayRound> = {}): MyDayRound => ({
  id: 'round-1',
  title: 'Ward 2 rounds',
  dueAt: at(12),
  items: [
    { id: 'ri-1', label: 'Poppy · Surolan 5 drops L ear', status: 'DUE' },
    { id: 'ri-2', label: 'Poppy · feed ¼ can i/d', status: 'DUE' },
  ],
  ...overrides,
});

const emptyInput = { now: NOW, appointments: [], tasks: [], rounds: [] };

describe('toRailDate', () => {
  it('returns a valid Date unchanged', () => {
    const date = at(9, 45);
    expect(toRailDate(date)).toBe(date);
  });

  it('returns null for an invalid Date', () => {
    expect(toRailDate(new Date('nonsense'))).toBeNull();
  });

  it('parses ISO strings and epoch numbers', () => {
    expect(toRailDate('2026-07-07T09:45:00.000Z')?.toISOString()).toBe('2026-07-07T09:45:00.000Z');
    expect(toRailDate(at(9, 45).getTime())?.getHours()).toBe(9);
  });

  it('returns null for unparseable strings and non-date values', () => {
    expect(toRailDate('not a date')).toBeNull();
    expect(toRailDate(null)).toBeNull();
    expect(toRailDate(undefined)).toBeNull();
    expect(toRailDate({})).toBeNull();
  });
});

describe('isSameCalendarDay', () => {
  it('is true for the same day and false across day, month and year', () => {
    expect(isSameCalendarDay(at(0, 1), at(23, 59))).toBe(true);
    expect(isSameCalendarDay(at(9), new Date(2026, 6, 8, 9))).toBe(false);
    expect(isSameCalendarDay(at(9), new Date(2026, 7, 7, 9))).toBe(false);
    expect(isSameCalendarDay(at(9), new Date(2025, 6, 7, 9))).toBe(false);
  });
});

describe('formatRailTime', () => {
  it('zero-pads hours and minutes', () => {
    expect(formatRailTime(at(9, 45))).toBe('09:45');
    expect(formatRailTime(at(13, 0))).toBe('13:00');
    expect(formatRailTime(at(0, 5))).toBe('00:05');
  });
});

describe('countDueRoundItems', () => {
  it('counts only DUE items', () => {
    expect(countDueRoundItems(makeRound())).toBe(2);
    expect(
      countDueRoundItems(
        makeRound({ items: [{ id: 'ri-1', label: 'Signed one', status: 'SIGNED' }] })
      )
    ).toBe(0);
  });
});

describe('buildAppointmentTitle', () => {
  it('joins the companion name and service', () => {
    expect(
      buildAppointmentTitle(
        makeAppointment({
          appointmentType: {
            id: 'svc-1',
            name: 'ear recheck',
            speciality: { id: 'sp-1', name: 'General' },
          },
        })
      )
    ).toBe('Pretzel · ear recheck');
  });

  it('falls back to the companion name alone when there is no service', () => {
    expect(buildAppointmentTitle(makeAppointment())).toBe('Pretzel');
    expect(
      buildAppointmentTitle(
        makeAppointment({
          appointmentType: {
            id: 'svc-1',
            name: '   ',
            speciality: { id: 'sp-1', name: 'General' },
          },
        })
      )
    ).toBe('Pretzel');
  });

  it('prefers the companion over the patient', () => {
    const appointment = makeAppointment();
    expect(
      buildAppointmentTitle({
        ...appointment,
        companion: { ...appointment.patient, name: 'Poppy' },
      })
    ).toBe('Poppy');
  });
});

describe('buildAppointmentSubtitle', () => {
  const entryFor = (appointment: Appointment, isDone: boolean): MyDayAppointmentEntry => ({
    kind: 'appointment',
    id: 'appointment:appt-1',
    at: at(9, 45),
    appointment,
    isDone,
    isNext: false,
  });

  it('leads with the done time for completed appointments', () => {
    expect(
      buildAppointmentSubtitle(
        entryFor(makeAppointment({ status: 'COMPLETED', concern: 'notes signed' }), true)
      )
    ).toBe('Done 09:45 · notes signed');
  });

  it('omits the time when a completed appointment has none', () => {
    expect(buildAppointmentSubtitle({ ...entryFor(makeAppointment(), true), at: null })).toBe(
      'Done'
    );
  });

  it('shows room, concern and parent for open appointments', () => {
    expect(
      buildAppointmentSubtitle(
        entryFor(
          makeAppointment({ room: { id: 'rm-1', name: 'Rm 1' }, concern: 'bloodwork due' }),
          false
        )
      )
    ).toBe('Rm 1 · bloodwork due · Lena Fischer');
  });

  it('skips blank room, concern and parent values', () => {
    expect(
      buildAppointmentSubtitle(
        entryFor(
          makeAppointment({
            room: { id: 'rm-1', name: '  ' },
            concern: '  ',
            patient: { ...makeAppointment().patient, parent: { id: 'p', name: '  ' } },
          }),
          false
        )
      )
    ).toBe('');
  });
});

describe('buildTaskSubtitle', () => {
  it('includes the due time and linked companion', () => {
    expect(buildTaskSubtitle(makeTask(), 'Poppy')).toBe('Task · due 13:00 · linked to Poppy');
  });

  it('drops the due time when the task is undated', () => {
    expect(buildTaskSubtitle(makeTask({ dueAt: undefined as unknown as Date }))).toBe('Task');
  });

  it('drops a blank companion name', () => {
    expect(buildTaskSubtitle(makeTask(), '  ')).toBe('Task · due 13:00');
  });
});

describe('buildRoundHeading', () => {
  it('appends the due count', () => {
    expect(buildRoundHeading(makeRound())).toBe('Ward 2 rounds · 2 due');
  });
});

describe('buildMyDayRail — empty inputs', () => {
  it('handles all three kinds being empty', () => {
    const rail = buildMyDayRail(emptyInput);
    expect(rail.dated).toEqual([]);
    expect(rail.anytime).toEqual([]);
    expect(rail.nowMarkerIndex).toBeNull();
    expect(rail.summary).toEqual({
      appointmentCount: 0,
      nextAppointmentAt: null,
      nextAppointmentId: null,
      taskCount: 0,
      overdueTaskCount: 0,
      roundCount: 0,
      roundsDueCount: 0,
      nextRoundDueAt: null,
    });
  });

  it('handles each kind being empty in turn', () => {
    const noAppointments = buildMyDayRail({
      ...emptyInput,
      tasks: [makeTask()],
      rounds: [makeRound()],
    });
    expect(noAppointments.summary.appointmentCount).toBe(0);
    expect(noAppointments.dated).toHaveLength(2);

    const noTasks = buildMyDayRail({
      ...emptyInput,
      appointments: [makeAppointment()],
      rounds: [makeRound()],
    });
    expect(noTasks.summary.taskCount).toBe(0);
    expect(noTasks.dated).toHaveLength(2);

    const noRounds = buildMyDayRail({
      ...emptyInput,
      appointments: [makeAppointment()],
      tasks: [makeTask()],
    });
    expect(noRounds.summary.roundsDueCount).toBe(0);
    expect(noRounds.dated).toHaveLength(2);
  });
});

describe('buildMyDayRail — interleaving', () => {
  it('threads all three kinds into one chronological rail', () => {
    const rail = buildMyDayRail({
      now: NOW,
      appointments: [
        makeAppointment({ id: 'a-late', startTime: at(15) }),
        makeAppointment({ id: 'a-early', startTime: at(9, 45), status: 'COMPLETED' }),
      ],
      tasks: [makeTask({ _id: 't-1', dueAt: at(13) })],
      rounds: [makeRound({ id: 'r-1', dueAt: at(12) })],
    });

    expect(rail.dated.map((entry) => [entry.kind, formatRailTime(entry.at as Date)])).toEqual([
      ['appointment', '09:45'],
      ['round', '12:00'],
      ['task', '13:00'],
      ['appointment', '15:00'],
    ]);
  });

  it('orders appointment → task → round when all three share a timestamp', () => {
    const input = {
      now: NOW,
      appointments: [makeAppointment({ id: 'a-1', startTime: at(12) })],
      tasks: [makeTask({ _id: 't-1', dueAt: at(12) })],
      rounds: [makeRound({ id: 'r-1', dueAt: at(12) })],
    };
    expect(buildMyDayRail(input).dated.map((entry) => entry.kind)).toEqual([
      'appointment',
      'task',
      'round',
    ]);
  });

  it('is stable regardless of input order and ties within a kind break by id', () => {
    const rail = buildMyDayRail({
      now: NOW,
      appointments: [
        makeAppointment({ id: 'b', startTime: at(12) }),
        makeAppointment({ id: 'a', startTime: at(12) }),
      ],
      tasks: [],
      rounds: [],
    });
    expect(rail.dated.map((entry) => entry.id)).toEqual(['appointment:a', 'appointment:b']);
  });
});

describe('buildMyDayRail — day filtering', () => {
  it('drops appointments, tasks and rounds outside today', () => {
    const yesterday = new Date(2026, 6, 6, 10);
    const rail = buildMyDayRail({
      now: NOW,
      appointments: [makeAppointment({ id: 'a-old', startTime: yesterday })],
      tasks: [makeTask({ _id: 't-old', dueAt: yesterday })],
      rounds: [makeRound({ id: 'r-old', dueAt: yesterday })],
    });
    expect(rail.dated).toEqual([]);
    expect(rail.anytime).toEqual([]);
    expect(rail.summary.taskCount).toBe(0);
    expect(rail.summary.roundsDueCount).toBe(0);
  });

  it('drops appointments with no usable start time', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      appointments: [makeAppointment({ startTime: undefined as unknown as Date })],
    });
    expect(rail.dated).toEqual([]);
    expect(rail.anytime).toEqual([]);
    expect(rail.summary.appointmentCount).toBe(0);
  });

  it('falls back to the array index when an id is missing', () => {
    const rail = buildMyDayRail({
      now: NOW,
      appointments: [makeAppointment({ id: undefined })],
      tasks: [makeTask({ _id: '' })],
      rounds: [makeRound({ id: '' })],
    });
    expect(rail.dated.map((entry) => entry.id)).toEqual(['appointment:0', 'round:0', 'task:0']);
  });
});

describe('buildMyDayRail — anytime group', () => {
  it('routes undated tasks and rounds to the anytime group', () => {
    const rail = buildMyDayRail({
      now: NOW,
      appointments: [makeAppointment()],
      tasks: [
        makeTask({ _id: 't-undated', name: 'Sign Laboklin form', dueAt: null as unknown as Date }),
        makeTask({ _id: 't-dated', dueAt: at(13) }),
      ],
      rounds: [makeRound({ id: 'r-undated', dueAt: null })],
    });

    expect(rail.anytime.map((entry) => entry.id)).toEqual(['task:t-undated', 'round:r-undated']);
    expect(rail.dated.map((entry) => entry.id)).toEqual(['appointment:appt-1', 'task:t-dated']);
  });

  it('counts undated tasks in the task total but never as overdue', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      tasks: [makeTask({ _id: 't-undated', dueAt: undefined as unknown as Date })],
    });
    expect(rail.summary.taskCount).toBe(1);
    expect(rail.summary.overdueTaskCount).toBe(0);
  });

  it('treats a round with no dueAt key as undated', () => {
    const rail = buildMyDayRail({ ...emptyInput, rounds: [{ ...makeRound(), dueAt: undefined }] });
    expect(rail.anytime).toHaveLength(1);
    expect(rail.summary.nextRoundDueAt).toBeNull();
  });
});

describe('buildMyDayRail — overdue and done', () => {
  it('marks a pending task before now as overdue', () => {
    const rail = buildMyDayRail({ ...emptyInput, tasks: [makeTask({ dueAt: at(9, 30) })] });
    expect(rail.summary.overdueTaskCount).toBe(1);
    expect(rail.dated[0]).toMatchObject({ kind: 'task', isOverdue: true, isDone: false });
  });

  it('does not mark an upcoming task as overdue', () => {
    const rail = buildMyDayRail({ ...emptyInput, tasks: [makeTask({ dueAt: at(13) })] });
    expect(rail.summary.overdueTaskCount).toBe(0);
  });

  it('never marks completed or cancelled tasks as overdue', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      tasks: [
        makeTask({ _id: 't-done', dueAt: at(9), status: 'COMPLETED' }),
        makeTask({ _id: 't-cancelled', dueAt: at(9), status: 'CANCELLED' }),
        makeTask({ _id: 't-progress', dueAt: at(9), status: 'IN_PROGRESS' }),
      ],
    });
    expect(rail.summary.taskCount).toBe(3);
    expect(rail.summary.overdueTaskCount).toBe(1);
    expect(rail.dated.map((entry) => (entry as { isDone: boolean }).isDone)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('marks a completed appointment as done', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      appointments: [makeAppointment({ status: 'COMPLETED' })],
    });
    expect(rail.dated[0]).toMatchObject({ isDone: true });
  });
});

describe('buildMyDayRail — next appointment', () => {
  it('picks the earliest non-terminal appointment at or after now', () => {
    const rail = buildMyDayRail({
      now: NOW,
      appointments: [
        makeAppointment({ id: 'a-past', startTime: at(9, 45), status: 'COMPLETED' }),
        makeAppointment({ id: 'a-next', startTime: at(10, 30) }),
        makeAppointment({ id: 'a-later', startTime: at(14) }),
      ],
      tasks: [],
      rounds: [],
    });
    expect(rail.summary.nextAppointmentId).toBe('appointment:a-next');
    expect(formatRailTime(rail.summary.nextAppointmentAt as Date)).toBe('10:30');
    expect(rail.dated.filter((entry) => entry.kind === 'appointment' && entry.isNext)).toHaveLength(
      1
    );
  });

  it('skips cancelled and no-show appointments when picking the next one', () => {
    const rail = buildMyDayRail({
      now: NOW,
      appointments: [
        makeAppointment({ id: 'a-cancelled', startTime: at(10, 30), status: 'CANCELLED' }),
        makeAppointment({ id: 'a-noshow', startTime: at(11), status: 'NO_SHOW' }),
        makeAppointment({ id: 'a-real', startTime: at(12) }),
      ],
      tasks: [],
      rounds: [],
    });
    expect(rail.summary.nextAppointmentId).toBe('appointment:a-real');
  });

  it('returns no next appointment when the whole day is behind now', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      appointments: [makeAppointment({ startTime: at(9) })],
    });
    expect(rail.summary.appointmentCount).toBe(1);
    expect(rail.summary.nextAppointmentAt).toBeNull();
    expect(rail.summary.nextAppointmentId).toBeNull();
  });
});

describe('buildMyDayRail — rounds summary', () => {
  it('sums due items across rounds and reports the earliest due round', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      rounds: [
        makeRound({ id: 'r-late', dueAt: at(16) }),
        makeRound({
          id: 'r-early',
          dueAt: at(12),
          items: [{ id: 'ri-9', label: 'One', status: 'DUE' }],
        }),
      ],
    });
    expect(rail.summary.roundsDueCount).toBe(3);
    expect(formatRailTime(rail.summary.nextRoundDueAt as Date)).toBe('12:00');
  });

  it('ignores fully signed rounds when picking the next due time', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      rounds: [
        makeRound({
          id: 'r-signed',
          dueAt: at(11),
          items: [{ id: 'ri-1', label: 'Done', status: 'SIGNED' }],
        }),
        makeRound({ id: 'r-due', dueAt: at(12) }),
      ],
    });
    expect(rail.summary.roundsDueCount).toBe(2);
    expect(formatRailTime(rail.summary.nextRoundDueAt as Date)).toBe('12:00');
  });
});

describe('buildMyDayRail — now marker', () => {
  it('sits after the entries that already passed', () => {
    const rail = buildMyDayRail({
      now: NOW,
      appointments: [
        makeAppointment({ id: 'a-1', startTime: at(9, 45), status: 'COMPLETED' }),
        makeAppointment({ id: 'a-2', startTime: at(10, 30) }),
      ],
      tasks: [],
      rounds: [],
    });
    expect(rail.nowMarkerIndex).toBe(1);
  });

  it('sits at the top when nothing has happened yet', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      appointments: [makeAppointment({ startTime: at(14) })],
    });
    expect(rail.nowMarkerIndex).toBe(0);
  });

  it('is null once the whole day has passed, rather than trailing the last entry', () => {
    // The marker divides done from upcoming. With nothing upcoming it would
    // render as a line across the empty space below the last row, marking
    // nothing - so it is withheld.
    const rail = buildMyDayRail({
      ...emptyInput,
      appointments: [makeAppointment({ startTime: at(9) })],
    });
    expect(rail.nowMarkerIndex).toBeNull();
  });

  it('is null when the rail has no dated entries', () => {
    const rail = buildMyDayRail({
      ...emptyInput,
      tasks: [makeTask({ dueAt: null as unknown as Date })],
    });
    expect(rail.nowMarkerIndex).toBeNull();
  });
});

describe('buildMyDaySummaryChips', () => {
  const chipsFor = (input: Parameters<typeof buildMyDayRail>[0]) =>
    Object.fromEntries(
      buildMyDaySummaryChips(buildMyDayRail(input).summary).map((chip) => [chip.key, chip.value])
    );

  it('renders the design values for a populated day', () => {
    const chips = buildMyDaySummaryChips(
      buildMyDayRail({
        now: NOW,
        appointments: [
          makeAppointment({ id: 'a-1', startTime: at(9, 45), status: 'COMPLETED' }),
          makeAppointment({ id: 'a-2', startTime: at(10, 30) }),
          makeAppointment({ id: 'a-3', startTime: at(11, 6) }),
          makeAppointment({ id: 'a-4', startTime: at(14) }),
          makeAppointment({ id: 'a-5', startTime: at(15) }),
        ],
        tasks: [
          makeTask({ _id: 't-1', dueAt: at(9), status: 'PENDING' }),
          makeTask({ _id: 't-2', dueAt: at(13) }),
          makeTask({ _id: 't-3', dueAt: null as unknown as Date }),
          makeTask({ _id: 't-4', dueAt: null as unknown as Date }),
        ],
        rounds: [makeRound()],
      }).summary
    );

    expect(chips).toEqual([
      { key: 'appointments', label: 'Appointments', value: '5 · next 10:30' },
      { key: 'tasks', label: 'Tasks', value: '4 · 1 overdue' },
      { key: 'rounds', label: 'Rounds', value: '2 due 12:00' },
    ]);
  });

  // Rounds have no backend representation yet, so a day with no rounds must not
  // advertise a Rounds chip at all.
  it('reports empty days and drops the rounds chip entirely', () => {
    expect(chipsFor(emptyInput)).toEqual({
      appointments: 'None today',
      tasks: 'None today',
    });
  });

  it('keeps a "None due" rounds chip when the day has rounds but none are due', () => {
    expect(
      chipsFor({
        ...emptyInput,
        rounds: [makeRound({ items: [{ id: 'i-1', label: 'Kennel 2', status: 'SIGNED' }] })],
      })
    ).toMatchObject({ rounds: 'None due' });
  });

  it('reports a finished day and on-track tasks', () => {
    expect(
      chipsFor({
        ...emptyInput,
        appointments: [makeAppointment({ startTime: at(9) })],
        tasks: [makeTask({ dueAt: at(13) })],
      })
    ).toMatchObject({ appointments: '1 · all done', tasks: '1 · on track' });
  });

  it('reports due rounds that carry no time', () => {
    expect(chipsFor({ ...emptyInput, rounds: [makeRound({ dueAt: null })] })).toMatchObject({
      rounds: '2 due',
    });
  });
});
