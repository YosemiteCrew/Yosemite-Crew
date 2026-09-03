/**
 * Action resolvers: intent plus app state to an answer.
 *
 * Every fact the assistant states comes from here, never from the language
 * model. The model may only rephrase a resolver's output. That boundary is
 * what keeps a hallucinated vaccination date out of a pet's health record.
 *
 * Resolvers are pure: they take a context and return a result. `now` is part
 * of the context so date maths is testable without freezing the clock.
 */
import type {
  AssistantActionId,
  AssistantActionResult,
  AssistantContext,
  AssistantResultItem,
  AssistantSlots,
  AssistantVaccination,
} from '../types';
import type {Appointment} from '@/features/appointments/types';
import type {Task} from '@/features/tasks/types';
import type {Companion} from '@/features/companion/types';
import {UPCOMING_WINDOW_DAYS, VACCINATION_DUE_SOON_DAYS} from '../constants';
import {getAssistantAction} from './catalogue';
import {normalizeText} from '../nlu/normalize';

const MS_PER_DAY = 86_400_000;

const daysBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);

/** Appointment date and time are stored separately; this joins them. */
export const appointmentStartsAt = (appointment: Appointment): Date | null => {
  if (appointment.start) {
    const parsed = new Date(appointment.start);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (!appointment.date) {
    return null;
  }
  // The guard accepted "09:15:30" but the interpolation appended a second
  // ":00", producing an Invalid Date - so an appointment whose time carried
  // seconds vanished from every answer. taskDueAt already sliced; this did not.
  const time =
    appointment.time && /^\d{2}:\d{2}/.test(appointment.time)
      ? appointment.time.slice(0, 5)
      : '00:00';
  const parsed = new Date(`${appointment.date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
]);

/** Finds the pet the question is about. */
export const resolveCompanion = (
  context: AssistantContext,
  slots: AssistantSlots,
): Companion | undefined => {
  if (slots.petName) {
    const wanted = normalizeText(slots.petName);
    const match = context.companions.find(
      companion => normalizeText(companion.name) === wanted,
    );
    if (match) {
      return match;
    }
  }
  // With exactly one pet, "when is the next appointment" is unambiguous.
  return context.companions.length === 1 ? context.companions[0] : undefined;
};

const companionsInScope = (
  context: AssistantContext,
  slots: AssistantSlots,
): Companion[] => {
  const single = resolveCompanion(context, slots);
  return single ? [single] : context.companions;
};

/**
 * A task's due moment.
 *
 * `dueAt` is the backend's full timestamp but is optional; tasks created
 * locally carry a `date` plus an optional `time` instead, so both shapes are
 * handled rather than treating a locally created task as undated.
 */
export const taskDueAt = (task: Task): Date | null => {
  if (task.dueAt) {
    const parsed = new Date(task.dueAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (!task.date) {
    return null;
  }
  const time =
    task.time && /^\d{2}:\d{2}/.test(task.time)
      ? task.time.slice(0, 5)
      : '00:00';
  const parsed = new Date(`${task.date.slice(0, 10)}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Tasks carry both a required `title` and an optional display `name`. */
export const taskLabel = (task: Task): string => task.name || task.title || '';

const isOpenTask = (task: Task): boolean => {
  const status = String(task.status ?? '').toUpperCase();
  return status !== 'COMPLETED' && status !== 'CANCELLED';
};

/**
 * Renders a calendar day in LOCAL time.
 *
 * `toISOString()` converts to UTC first, so local midnight on the 12th printed
 * as the 11th at any positive offset - a wrong date read aloud to the owner.
 */
const formatDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses a record date, reading a date-only value as LOCAL midnight.
 *
 * Appointment and task dates are already read locally; parsing a vaccination's
 * date-only string with `new Date()` would read it as UTC and put the same
 * calendar day at a different instant.
 */
export const parseRecordDate = (value: string): Date | null => {
  const trimmed = value.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** "when is my next appointment" */
export const resolveNextAppointment = (
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult => {
  const scope = companionsInScope(context, slots);
  const scopeIds = new Set(scope.map(companion => companion.id));
  const nameById = new Map(scope.map(c => [c.id, c.name]));

  const upcoming = context.appointments
    .filter(appointment => scopeIds.has(appointment.companionId))
    .filter(appointment => !TERMINAL_STATUSES.has(appointment.status))
    .map(appointment => ({
      appointment,
      startsAt: appointmentStartsAt(appointment),
    }))
    .filter(
      (entry): entry is {appointment: Appointment; startsAt: Date} =>
        entry.startsAt !== null &&
        entry.startsAt.getTime() >= context.now.getTime(),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const next = upcoming[0];
  if (!next) {
    return {
      actionId: 'nextAppointment',
      status: 'empty',
      speechKey: 'assistant.replies.nextAppointment.none',
      speechParams: {petName: scope.length === 1 ? scope[0].name : ''},
    };
  }

  const petName = nameById.get(next.appointment.companionId) ?? '';
  return {
    actionId: 'nextAppointment',
    status: 'ok',
    speechKey: 'assistant.replies.nextAppointment.found',
    speechParams: {
      petName,
      date: formatDay(next.startsAt),
      time: next.appointment.time ?? '',
      business: next.appointment.organisationName ?? '',
    },
    data: {
      petName,
      appointmentId: next.appointment.id,
      dateLabel: formatDay(next.startsAt),
      items: upcoming.slice(0, 3).map(entry => ({
        id: entry.appointment.id,
        title: entry.appointment.serviceName ?? entry.appointment.type,
        subtitle:
          `${formatDay(entry.startsAt)} ${entry.appointment.time ?? ''}`.trim(),
      })),
    },
  };
};

/** "is Bruno up to date on his vaccines" */
export const resolveVaccinationStatus = (
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult => {
  const companion = resolveCompanion(context, slots);
  if (!companion) {
    return {
      actionId: 'vaccinationStatus',
      status: 'needsSlot',
      missingSlot: 'petName',
      speechKey: 'assistant.replies.needsPet',
    };
  }

  const records = context.vaccinations[companion.id] ?? [];
  if (records.length === 0) {
    return {
      actionId: 'vaccinationStatus',
      status: 'empty',
      speechKey: 'assistant.replies.vaccinationStatus.none',
      speechParams: {petName: companion.name},
      data: {petName: companion.name},
    };
  }

  const dated = records
    .map(record => ({
      record,
      dueOn: record.dueOn ? parseRecordDate(record.dueOn) : null,
    }))
    .filter(
      (entry): entry is {record: AssistantVaccination; dueOn: Date} =>
        entry.dueOn !== null,
    )
    .sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime());

  // Partitioned rather than filtered twice. A record overdue by a few hours
  // rounded to -0 days, which satisfied `>= 0`, so it appeared in both lists
  // and rendered twice in the card. Sorting also means "most overdue" and
  // "soonest due" are simply the first element of each.
  const overdue = dated.filter(
    entry => entry.dueOn.getTime() < context.now.getTime(),
  );
  const dueSoon = dated.filter(entry => {
    if (entry.dueOn.getTime() < context.now.getTime()) {
      return false;
    }
    return daysBetween(context.now, entry.dueOn) <= VACCINATION_DUE_SOON_DAYS;
  });

  const items: AssistantResultItem[] = [...overdue, ...dueSoon].map(entry => ({
    id: entry.record.name,
    title: entry.record.name,
    subtitle: formatDay(entry.dueOn),
  }));

  if (overdue.length > 0) {
    return {
      actionId: 'vaccinationStatus',
      status: 'ok',
      speechKey: 'assistant.replies.vaccinationStatus.overdue',
      speechParams: {
        petName: companion.name,
        count: overdue.length,
        name: overdue[0].record.name,
      },
      data: {petName: companion.name, items},
    };
  }

  if (dueSoon.length > 0) {
    const soonest = dueSoon[0];
    return {
      actionId: 'vaccinationStatus',
      status: 'ok',
      speechKey: 'assistant.replies.vaccinationStatus.dueSoon',
      speechParams: {
        petName: companion.name,
        name: soonest.record.name,
        date: formatDay(soonest.dueOn),
      },
      data: {petName: companion.name, items},
    };
  }

  return {
    actionId: 'vaccinationStatus',
    status: 'ok',
    speechKey: 'assistant.replies.vaccinationStatus.upToDate',
    speechParams: {petName: companion.name},
    data: {petName: companion.name},
  };
};

/** "what is due today" / "what does Bruno need this week" */
export const resolveUpcomingTasks = (
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult => {
  const scope = companionsInScope(context, slots);
  const scopeIds = new Set(scope.map(companion => companion.id));

  const windowEnd = slots.when
    ? new Date(slots.when)
    : new Date(context.now.getTime() + UPCOMING_WINDOW_DAYS * MS_PER_DAY);
  const endTime = Number.isNaN(windowEnd.getTime())
    ? context.now.getTime() + UPCOMING_WINDOW_DAYS * MS_PER_DAY
    : // A named day means "through the end of that day", not "up to 9am".
      new Date(windowEnd).setHours(23, 59, 59, 999);

  const due = context.tasks
    .filter(task => scopeIds.has(task.companionId))
    .filter(isOpenTask)
    .map(task => ({task, dueAt: taskDueAt(task)}))
    .filter(
      (entry): entry is {task: Task; dueAt: Date} =>
        entry.dueAt !== null &&
        entry.dueAt.getTime() >= context.now.getTime() - MS_PER_DAY &&
        entry.dueAt.getTime() <= endTime,
    )
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  if (due.length === 0) {
    return {
      actionId: 'upcomingTasks',
      status: 'empty',
      speechKey: 'assistant.replies.upcomingTasks.none',
      speechParams: {petName: scope.length === 1 ? scope[0].name : ''},
    };
  }

  return {
    actionId: 'upcomingTasks',
    status: 'ok',
    speechKey: 'assistant.replies.upcomingTasks.found',
    speechParams: {
      count: due.length,
      first: taskLabel(due[0].task),
      petName: scope.length === 1 ? scope[0].name : '',
    },
    data: {
      petName: scope.length === 1 ? scope[0].name : undefined,
      taskIds: due.map(entry => entry.task.id),
      items: due.slice(0, 5).map(entry => ({
        id: entry.task.id,
        title: taskLabel(entry.task),
        subtitle: formatDay(entry.dueAt),
      })),
    },
  };
};

/** "tell me about Bruno" */
export const resolvePetOverview = (
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult => {
  const companion = resolveCompanion(context, slots);
  if (!companion) {
    return {
      actionId: 'petOverview',
      status: 'needsSlot',
      missingSlot: 'petName',
      speechKey: 'assistant.replies.needsPet',
    };
  }

  const openTasks = context.tasks.filter(
    task => task.companionId === companion.id && isOpenTask(task),
  ).length;
  // Filtered on time as well as status: a year-old CONFIRMED appointment that
  // was never marked COMPLETED was still being counted as upcoming.
  const upcomingAppointments = context.appointments.filter(appointment => {
    if (appointment.companionId !== companion.id) {
      return false;
    }
    if (TERMINAL_STATUSES.has(appointment.status)) {
      return false;
    }
    const startsAt = appointmentStartsAt(appointment);
    return startsAt !== null && startsAt.getTime() >= context.now.getTime();
  }).length;

  return {
    actionId: 'petOverview',
    status: 'ok',
    speechKey: 'assistant.replies.petOverview.summary',
    speechParams: {
      petName: companion.name,
      breed: companion.breed?.breedName ?? '',
      tasks: openTasks,
      appointments: upcomingAppointments,
    },
    data: {petName: companion.name},
  };
};

/** "how much have I spent on Bruno" */
export const resolveExpenseSummary = (
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult => {
  const scope = companionsInScope(context, slots);
  const scopeIds = new Set(scope.map(companion => companion.id));

  const relevant = context.expenses.filter(expense =>
    scopeIds.has(expense.companionId),
  );

  if (relevant.length === 0) {
    return {
      actionId: 'expenseSummary',
      status: 'empty',
      speechKey: 'assistant.replies.expenseSummary.none',
      speechParams: {petName: scope.length === 1 ? scope[0].name : ''},
    };
  }

  const total = relevant.reduce(
    (sum, expense) =>
      sum + (Number.isFinite(expense.amount) ? expense.amount : 0),
    0,
  );
  const currencyCode = relevant[0].currencyCode || context.currencyCode;

  return {
    actionId: 'expenseSummary',
    status: 'ok',
    speechKey: 'assistant.replies.expenseSummary.total',
    speechParams: {
      total: Number(total.toFixed(2)),
      currency: currencyCode,
      petName: scope.length === 1 ? scope[0].name : '',
      count: relevant.length,
    },
    data: {
      petName: scope.length === 1 ? scope[0].name : undefined,
      amount: Number(total.toFixed(2)),
      currencyCode,
    },
  };
};

/**
 * Builds the deep link for a handoff action.
 *
 * Handoff actions never commit anything. Booking needs live availability and
 * payment, and a medication reminder deserves a human confirming the dose, so
 * the assistant opens the right screen with the slots prefilled instead.
 */
export const buildHandoffLink = (
  actionId: AssistantActionId,
  slots: AssistantSlots,
  companionId?: string,
): string | undefined => {
  const action = getAssistantAction(actionId);
  if (!action?.deepLink) {
    return undefined;
  }

  const params = new URLSearchParams();
  if (companionId) {
    params.set('companionId', companionId);
  }
  if (slots.title) {
    params.set('title', slots.title);
  }
  if (slots.when) {
    params.set('when', slots.when);
  }
  if (slots.amount !== undefined) {
    params.set('amount', String(slots.amount));
  }
  if (slots.category) {
    params.set('category', slots.category);
  }

  const query = params.toString();
  return query ? `${action.deepLink}?${query}` : action.deepLink;
};

const resolveHandoff = (
  actionId: AssistantActionId,
  speechKey: string,
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult => {
  const companion = resolveCompanion(context, slots);
  return {
    actionId,
    status: 'handoff',
    speechKey,
    speechParams: {
      petName: companion?.name ?? '',
      title: slots.title ?? '',
    },
    deepLink: buildHandoffLink(actionId, slots, companion?.id),
    data: {petName: companion?.name},
  };
};

export const resolveAddCareTask = (
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult =>
  resolveHandoff(
    'addCareTask',
    'assistant.replies.addCareTask.handoff',
    context,
    slots,
  );

export const resolveLogExpense = (
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult =>
  resolveHandoff(
    'logExpense',
    'assistant.replies.logExpense.handoff',
    context,
    slots,
  );

export const resolveBookAppointment = (
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult =>
  resolveHandoff(
    'bookAppointment',
    'assistant.replies.bookAppointment.handoff',
    context,
    slots,
  );

type Resolver = (
  context: AssistantContext,
  slots: AssistantSlots,
) => AssistantActionResult;

const RESOLVERS: Record<AssistantActionId, Resolver> = {
  nextAppointment: resolveNextAppointment,
  vaccinationStatus: resolveVaccinationStatus,
  upcomingTasks: resolveUpcomingTasks,
  petOverview: resolvePetOverview,
  expenseSummary: resolveExpenseSummary,
  addCareTask: resolveAddCareTask,
  logExpense: resolveLogExpense,
  bookAppointment: resolveBookAppointment,
};

/** Runs the resolver for an action id. */
export const runAction = (
  actionId: AssistantActionId,
  context: AssistantContext,
  slots: AssistantSlots,
): AssistantActionResult => RESOLVERS[actionId](context, slots);
