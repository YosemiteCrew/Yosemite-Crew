/** Selectors for the assistant feature. */
import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {AssistantContext, AssistantVaccination} from './types';

export const selectAssistantMessages = (state: RootState) =>
  state.assistant?.messages ?? [];

export const selectAssistantStatus = (state: RootState) =>
  state.assistant?.status ?? 'idle';

export const selectAssistantError = (state: RootState) =>
  state.assistant?.error ?? null;

export const selectModelAvailability = (state: RootState) =>
  state.assistant?.modelAvailability ?? {available: false};

export const selectAssistantEnabled = (state: RootState) =>
  state.assistant?.enabled ?? true;

const selectCompanions = (state: RootState) =>
  state.companion?.companions ?? [];
const selectTasks = (state: RootState) => state.tasks?.items ?? [];
const selectAppointments = (state: RootState) =>
  state.appointments?.items ?? [];
const selectExpenses = (state: RootState) => state.expenses?.items ?? [];
const selectPassports = (state: RootState) =>
  state.passport?.byCompanionId ?? {};

/**
 * Flattens each pet's passport into the vaccination shape the resolvers use.
 *
 * The passport DTO nests records under several optional keys depending on how
 * the record was created, so anything without a name is skipped rather than
 * surfaced as a blank line in an answer.
 */
export const selectVaccinationsByCompanion = createSelector(
  [selectPassports],
  passports => {
    const result: Record<string, AssistantVaccination[]> = {};
    for (const [companionId, passport] of Object.entries(passports)) {
      const records = (passport as {vaccinations?: unknown})?.vaccinations;
      if (!Array.isArray(records)) {
        continue;
      }
      const mapped: AssistantVaccination[] = [];
      for (const record of records) {
        const entry = record as {
          name?: string;
          vaccineName?: string;
          administeredOn?: string;
          date?: string;
          dueOn?: string;
          nextDueDate?: string;
        };
        // `??` only falls through on null/undefined, so a record carrying
        // `name: ''` alongside a real `vaccineName` was dropped entirely, and
        // an empty `administeredOn` hid a populated `date`.
        const name = (entry.name || entry.vaccineName || '').trim();
        if (!name) {
          continue;
        }
        mapped.push({
          name,
          administeredOn: entry.administeredOn || entry.date || null,
          dueOn: entry.dueOn || entry.nextDueDate || null,
        });
      }
      result[companionId] = mapped;
    }
    return result;
  },
);

/**
 * Assembles the read-only context the resolvers work from.
 *
 * `now` is not part of the memoised result: a selector that captured the
 * current time would either be recomputed on every render or, worse, answer
 * "today" with a stale day after midnight. Callers pass the clock in.
 */
export const selectAssistantData = createSelector(
  [
    selectCompanions,
    selectTasks,
    selectAppointments,
    selectExpenses,
    selectVaccinationsByCompanion,
  ],
  (companions, tasks, appointments, expenses, vaccinations) => ({
    companions,
    tasks,
    appointments,
    expenses,
    vaccinations,
  }),
);

export const buildAssistantContext = (
  data: ReturnType<typeof selectAssistantData>,
  now: Date,
  currencyCode: string,
): AssistantContext => ({...data, now, currencyCode});
