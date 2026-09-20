/**
 * The offline snapshot handed to the native layer.
 *
 * When Siri runs an App Intent, the app's JavaScript is not running: the
 * intent executes in its own process with no Redux store and no session. So
 * the app writes a small, current answer sheet into shared storage every time
 * the relevant data changes, and the native side reads that.
 *
 * Only what an intent can actually say out loud goes in here. No tokens, no
 * addresses, no clinical notes - a snapshot is readable by any process in the
 * app group, so it holds the minimum that makes the answers useful.
 */
import type {AssistantContext} from '../types';
import {
  SNAPSHOT_ITEM_LIMIT,
  SNAPSHOT_PET_LIMIT,
  UPCOMING_WINDOW_DAYS,
  VACCINATION_STALE_DAYS,
} from '../constants';
import {getSnapshotModule} from './nativeBridge';
import {
  appointmentStartsAt,
  parseRecordDate,
  taskDueAt,
  taskLabel,
} from '../actions/resolvers';

export interface SnapshotPet {
  id: string;
  name: string;
  species: string;
}

export interface SnapshotEntry {
  petId: string;
  petName: string;
  title: string;
  /** ISO-8601. The native side formats it in the device locale. */
  at: string;
  subtitle?: string;
}

export interface AssistantSnapshotPayload {
  version: 1;
  generatedAt: string;
  pets: SnapshotPet[];
  appointments: SnapshotEntry[];
  tasks: SnapshotEntry[];
  vaccinationsDue: SnapshotEntry[];
}

const MS_PER_DAY = 86_400_000;

const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
]);

/** Builds the payload from the same context the in-app resolvers use. */
export const buildSnapshot = (
  context: AssistantContext,
): AssistantSnapshotPayload => {
  const pets = context.companions.slice(0, SNAPSHOT_PET_LIMIT);
  const nameById = new Map(pets.map(pet => [pet.id, pet.name]));
  const horizon = context.now.getTime() + UPCOMING_WINDOW_DAYS * MS_PER_DAY;

  const appointments = context.appointments
    .filter(appointment => nameById.has(appointment.companionId))
    .filter(appointment => !TERMINAL_STATUSES.has(appointment.status))
    .map(appointment => ({
      appointment,
      startsAt: appointmentStartsAt(appointment),
    }))
    .filter(
      entry =>
        entry.startsAt !== null &&
        entry.startsAt.getTime() >= context.now.getTime() &&
        entry.startsAt.getTime() <= horizon,
    )
    .sort(
      (a, b) => (a.startsAt as Date).getTime() - (b.startsAt as Date).getTime(),
    )
    .slice(0, SNAPSHOT_ITEM_LIMIT)
    .map(entry => ({
      petId: entry.appointment.companionId,
      petName: nameById.get(entry.appointment.companionId) ?? '',
      title: entry.appointment.serviceName ?? entry.appointment.type ?? '',
      at: (entry.startsAt as Date).toISOString(),
      subtitle: entry.appointment.organisationName ?? undefined,
    }));

  const tasks = context.tasks
    .filter(task => nameById.has(task.companionId))
    .filter(task => {
      const status = String(task.status ?? '').toUpperCase();
      return status !== 'COMPLETED' && status !== 'CANCELLED';
    })
    .map(task => ({task, dueAt: taskDueAt(task)}))
    .filter(
      entry =>
        entry.dueAt !== null &&
        entry.dueAt.getTime() >= context.now.getTime() - MS_PER_DAY &&
        entry.dueAt.getTime() <= horizon,
    )
    .sort((a, b) => (a.dueAt as Date).getTime() - (b.dueAt as Date).getTime())
    .slice(0, SNAPSHOT_ITEM_LIMIT)
    .map(entry => ({
      petId: entry.task.companionId,
      petName: nameById.get(entry.task.companionId) ?? '',
      title: taskLabel(entry.task),
      at: (entry.dueAt as Date).toISOString(),
    }));

  // Overdue shots matter, so they stay - but only recent ones. Without a lower
  // bound a pet with years of unrecorded history filled all twenty slots with
  // ancient entries and pushed out the shot actually due next week.
  const staleBefore =
    context.now.getTime() - VACCINATION_STALE_DAYS * MS_PER_DAY;
  const vaccinationsDue: SnapshotEntry[] = [];
  for (const pet of pets) {
    for (const record of context.vaccinations[pet.id] ?? []) {
      if (!record.dueOn) {
        continue;
      }
      const due = parseRecordDate(record.dueOn);
      if (
        due === null ||
        due.getTime() > horizon ||
        due.getTime() < staleBefore
      ) {
        continue;
      }
      vaccinationsDue.push({
        petId: pet.id,
        petName: pet.name,
        title: record.name,
        at: due.toISOString(),
      });
    }
  }
  vaccinationsDue.sort((a, b) => a.at.localeCompare(b.at));

  return {
    version: 1,
    generatedAt: context.now.toISOString(),
    pets: pets.map(pet => ({
      id: pet.id,
      name: pet.name,
      species: pet.category,
    })),
    appointments,
    tasks,
    vaccinationsDue: vaccinationsDue.slice(0, SNAPSHOT_ITEM_LIMIT),
  };
};

/**
 * Pushes the snapshot to the native side.
 *
 * Resolves false rather than throwing when the module is missing, so a caller
 * in a `useEffect` never has to guard it.
 */
export const publishSnapshot = async (
  context: AssistantContext,
): Promise<boolean> => {
  const module = getSnapshotModule();
  if (!module) {
    return false;
  }
  try {
    return await module.writeSnapshot(JSON.stringify(buildSnapshot(context)));
  } catch {
    return false;
  }
};

/** Removes the snapshot. Called on sign-out so a signed-out phone says nothing. */
export const clearSnapshot = async (): Promise<boolean> => {
  const module = getSnapshotModule();
  if (!module) {
    return false;
  }
  try {
    return await module.clearSnapshot();
  } catch {
    return false;
  }
};

/**
 * Picks up a deep link left by a Siri intent or an Android shortcut.
 *
 * Returns null when nothing is pending. The native side clears the value as it
 * reads it, so a link is acted on exactly once even if the app is resumed
 * repeatedly.
 */
export const consumePendingLink = async (): Promise<string | null> => {
  const module = getSnapshotModule();
  if (!module) {
    return null;
  }
  try {
    const link = await module.consumePendingLink();
    return link && link.length > 0 ? link : null;
  } catch {
    return null;
  }
};
