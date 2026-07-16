import type { Appointment } from '@yosemite-crew/types';
import type { Task } from '@/app/features/tasks/types/task';

/**
 * Ward rounds have no backend representation yet — there is no Round model, type
 * or endpoint anywhere in the monorepo. This is a minimal, presentation-only
 * shape so the "My day" rail can thread rounds alongside appointments and tasks.
 * Replace it with the canonical type once rounds exist in the domain.
 */
export type MyDayRoundItemStatus = 'DUE' | 'SIGNED';

export type MyDayRoundItem = {
  id: string;
  label: string;
  status: MyDayRoundItemStatus;
};

export type MyDayRound = {
  id: string;
  title: string;
  /** Omitted or null means the round is undated and lands in "Anytime today". */
  dueAt?: Date | null;
  items: MyDayRoundItem[];
};

export type MyDayView = 'clinic' | 'my-day';

export type MyDayAppointmentEntry = {
  kind: 'appointment';
  id: string;
  at: Date | null;
  appointment: Appointment;
  isDone: boolean;
  isNext: boolean;
};

export type MyDayTaskEntry = {
  kind: 'task';
  id: string;
  at: Date | null;
  task: Task;
  isDone: boolean;
  isOverdue: boolean;
};

export type MyDayRoundEntry = {
  kind: 'round';
  id: string;
  at: Date | null;
  round: MyDayRound;
  dueCount: number;
};

export type MyDayRailEntry = MyDayAppointmentEntry | MyDayTaskEntry | MyDayRoundEntry;

/** A rail entry that carries a time, and so has a place on the chronological thread. */
export type MyDayDatedEntry = MyDayRailEntry & { at: Date };

export type MyDaySummary = {
  appointmentCount: number;
  nextAppointmentAt: Date | null;
  nextAppointmentId: string | null;
  taskCount: number;
  overdueTaskCount: number;
  roundsDueCount: number;
  nextRoundDueAt: Date | null;
};

export type MyDayRail = {
  /** Chronological thread of appointments, tasks and rounds that carry a time. */
  dated: MyDayDatedEntry[];
  /**
   * Undated items — the "Anytime today" group. Appointments always carry a start
   * time, so only tasks and rounds can ever land here.
   */
  anytime: (MyDayTaskEntry | MyDayRoundEntry)[];
  summary: MyDaySummary;
  /** Index in `dated` where the "now" marker belongs, or null when the rail is empty. */
  nowMarkerIndex: number | null;
};

export type MyDayRailInput = {
  now: Date;
  appointments: Appointment[];
  tasks: Task[];
  rounds: MyDayRound[];
};

export type MyDaySummaryChip = {
  key: 'appointments' | 'tasks' | 'rounds';
  label: string;
  value: string;
};

const KIND_ORDER: Record<MyDayRailEntry['kind'], number> = {
  appointment: 0,
  task: 1,
  round: 2,
};

const TERMINAL_APPOINTMENT_STATUSES: ReadonlySet<string> = new Set([
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

const TERMINAL_TASK_STATUSES: ReadonlySet<string> = new Set(['COMPLETED', 'CANCELLED']);

/** Coerce a timestamp-ish value into a usable Date, or null when it is unusable. */
export const toRailDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

export const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatRailTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export const countDueRoundItems = (round: MyDayRound): number =>
  round.items.filter((item) => item.status === 'DUE').length;

export const buildAppointmentTitle = (appointment: Appointment): string => {
  const companion = appointment.companion ?? appointment.patient;
  const service = appointment.appointmentType?.name?.trim();
  return service ? `${companion.name} · ${service}` : companion.name;
};

export const buildAppointmentSubtitle = (entry: MyDayAppointmentEntry): string => {
  const parts: string[] = [];
  if (entry.isDone) {
    parts.push(entry.at ? `Done ${formatRailTime(entry.at)}` : 'Done');
  }
  const room = entry.appointment.room?.name?.trim();
  if (!entry.isDone && room) parts.push(room);
  const concern = entry.appointment.concern?.trim();
  if (concern) parts.push(concern);
  const parent = entry.appointment.patient.parent.name?.trim();
  if (!entry.isDone && parent) parts.push(parent);
  return parts.join(' · ');
};

export const buildTaskSubtitle = (task: Task, companionName?: string): string => {
  const parts = ['Task'];
  const dueAt = toRailDate(task.dueAt);
  if (dueAt) parts.push(`due ${formatRailTime(dueAt)}`);
  const name = companionName?.trim();
  if (name) parts.push(`linked to ${name}`);
  return parts.join(' · ');
};

export const buildRoundHeading = (round: MyDayRound): string =>
  `${round.title} · ${countDueRoundItems(round)} due`;

const compareRailEntries = (a: MyDayRailEntry, b: MyDayRailEntry): number => {
  const aTime = a.at?.getTime() ?? 0;
  const bTime = b.at?.getTime() ?? 0;
  if (aTime !== bTime) return aTime - bTime;
  const kindDelta = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (kindDelta !== 0) return kindDelta;
  return a.id.localeCompare(b.id);
};

const toAppointmentEntries = (appointments: Appointment[], now: Date): MyDayAppointmentEntry[] => {
  const entries: MyDayAppointmentEntry[] = [];
  appointments.forEach((appointment, index) => {
    const at = toRailDate(appointment.startTime);
    // An appointment with no usable start time cannot be placed on a day rail.
    if (!at || !isSameCalendarDay(at, now)) return;
    entries.push({
      kind: 'appointment',
      id: `appointment:${appointment.id ?? index}`,
      at,
      appointment,
      isDone: appointment.status === 'COMPLETED',
      isNext: false,
    });
  });
  return entries;
};

const toTaskEntries = (tasks: Task[], now: Date): MyDayTaskEntry[] => {
  const entries: MyDayTaskEntry[] = [];
  tasks.forEach((task, index) => {
    const at = toRailDate(task.dueAt);
    // Undated tasks are today's inbox — they fall through to "Anytime today".
    if (at && !isSameCalendarDay(at, now)) return;
    const isDone = TERMINAL_TASK_STATUSES.has(task.status);
    entries.push({
      kind: 'task',
      id: `task:${task._id || index}`,
      at,
      task,
      isDone,
      isOverdue: at !== null && at.getTime() < now.getTime() && !isDone,
    });
  });
  return entries;
};

const toRoundEntries = (rounds: MyDayRound[], now: Date): MyDayRoundEntry[] => {
  const entries: MyDayRoundEntry[] = [];
  rounds.forEach((round, index) => {
    const at = toRailDate(round.dueAt);
    if (at && !isSameCalendarDay(at, now)) return;
    entries.push({
      kind: 'round',
      id: `round:${round.id || index}`,
      at,
      round,
      dueCount: countDueRoundItems(round),
    });
  });
  return entries;
};

const findNextAppointment = (
  dated: MyDayDatedEntry[],
  now: Date
): MyDayAppointmentEntry | undefined =>
  dated.find(
    (entry): entry is MyDayAppointmentEntry & { at: Date } =>
      entry.kind === 'appointment' &&
      !TERMINAL_APPOINTMENT_STATUSES.has(entry.appointment.status) &&
      entry.at.getTime() >= now.getTime()
  );

const findNextRoundDueAt = (dated: MyDayDatedEntry[]): Date | null => {
  const entry = dated.find(
    (item): item is MyDayRoundEntry & { at: Date } => item.kind === 'round' && item.dueCount > 0
  );
  return entry?.at ?? null;
};

/**
 * Thread appointments, tasks and rounds onto a single chronological rail.
 *
 * Items whose timestamp falls outside `now`'s calendar day are dropped. Items
 * with no usable timestamp (tasks and rounds) land in the "Anytime today" group.
 * Entries sharing a timestamp are ordered appointment → task → round, then by id,
 * so the rail is stable regardless of input order.
 */
export const buildMyDayRail = ({ now, appointments, tasks, rounds }: MyDayRailInput): MyDayRail => {
  const entries: MyDayRailEntry[] = [
    ...toAppointmentEntries(appointments, now),
    ...toTaskEntries(tasks, now),
    ...toRoundEntries(rounds, now),
  ];

  const dated = entries
    .filter((entry): entry is MyDayDatedEntry => entry.at !== null)
    .sort(compareRailEntries);
  const anytime = entries
    .filter((entry): entry is MyDayTaskEntry | MyDayRoundEntry => entry.at === null)
    .sort(compareRailEntries);

  const next = findNextAppointment(dated, now);
  if (next) next.isNext = true;

  const taskEntries = entries.filter((entry): entry is MyDayTaskEntry => entry.kind === 'task');

  const summary: MyDaySummary = {
    appointmentCount: dated.filter((entry) => entry.kind === 'appointment').length,
    nextAppointmentAt: next?.at ?? null,
    nextAppointmentId: next?.id ?? null,
    taskCount: taskEntries.length,
    overdueTaskCount: taskEntries.filter((entry) => entry.isOverdue).length,
    roundsDueCount: entries.reduce(
      (total, entry) => (entry.kind === 'round' ? total + entry.dueCount : total),
      0
    ),
    nextRoundDueAt: findNextRoundDueAt(dated),
  };

  const nowMarkerIndex =
    dated.length === 0 ? null : dated.filter((entry) => entry.at.getTime() <= now.getTime()).length;

  return { dated, anytime, summary, nowMarkerIndex };
};

const appointmentChipValue = (summary: MyDaySummary): string => {
  if (summary.appointmentCount === 0) return 'None today';
  if (summary.nextAppointmentAt) {
    return `${summary.appointmentCount} · next ${formatRailTime(summary.nextAppointmentAt)}`;
  }
  return `${summary.appointmentCount} · all done`;
};

const taskChipValue = (summary: MyDaySummary): string => {
  if (summary.taskCount === 0) return 'None today';
  if (summary.overdueTaskCount > 0) {
    return `${summary.taskCount} · ${summary.overdueTaskCount} overdue`;
  }
  return `${summary.taskCount} · on track`;
};

const roundChipValue = (summary: MyDaySummary): string => {
  if (summary.roundsDueCount === 0) return 'None due';
  if (summary.nextRoundDueAt) {
    return `${summary.roundsDueCount} due ${formatRailTime(summary.nextRoundDueAt)}`;
  }
  return `${summary.roundsDueCount} due`;
};

export const buildMyDaySummaryChips = (summary: MyDaySummary): MyDaySummaryChip[] => [
  { key: 'appointments', label: 'Appointments', value: appointmentChipValue(summary) },
  { key: 'tasks', label: 'Tasks', value: taskChipValue(summary) },
  { key: 'rounds', label: 'Rounds', value: roundChipValue(summary) },
];
