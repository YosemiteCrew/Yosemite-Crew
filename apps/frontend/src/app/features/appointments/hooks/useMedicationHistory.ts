'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  listMedicationAdministrations,
  type MedicationAdministrationEntry,
} from '@/app/features/appointments/services/medicationAdministrationService';

export type UseMedicationHistory = {
  /** Every dose recorded for the encounter, earliest scheduled time first. */
  entries: MedicationAdministrationEntry[];
  isLoading: boolean;
  /** The panel's single error message, or null when nothing has failed. */
  error: string | null;
  /** True when reloading the history is the fix, so the banner offers Refresh. */
  canRefresh: boolean;
  reload: () => void;
  clearError: () => void;
  /**
   * Report a failed write whose effect on the server is unknown: the panel may
   * now be showing a dose that is no longer scheduled, so offer a reload.
   */
  reportStaleData: (message: string) => void;
  /** Report a failed write that provably changed nothing on the server. */
  reportFailure: (message: string) => void;
  appendEntry: (entry: MedicationAdministrationEntry) => void;
  applyOutcome: (entryId: string, entry: MedicationAdministrationEntry) => void;
};

const compareScheduledAt = (a: MedicationAdministrationEntry, b: MedicationAdministrationEntry) =>
  a.scheduledAt.localeCompare(b.scheduledAt);

const LOAD_ERROR = 'Unable to load medication history. Please try again.';

/**
 * Load and maintain one inpatient encounter's medication administration record.
 *
 * History is fetched once per set of encounter identifiers and refetched on
 * demand, because the panel's own writes are applied to the loaded rows
 * directly: recording an outcome returns the saved entry, so the row updates
 * without a round trip. A write that fails is the one case the panel cannot
 * patch locally, which is what makes the banner offer a reload there.
 */
export const useMedicationHistory = (
  organisationId?: string,
  patientId?: string,
  encounterId?: string
): UseMedicationHistory => {
  const [entries, setEntries] = useState<MedicationAdministrationEntry[]>([]);
  const [completedLoadAttempt, setCompletedLoadAttempt] = useState<number | null>(null);
  const [canRefresh, setCanRefresh] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(organisationId && patientId && encounterId);
  const isLoading = ready && completedLoadAttempt !== loadAttempt;

  useEffect(() => {
    if (!organisationId || !patientId || !encounterId) return;
    let active = true;
    listMedicationAdministrations(organisationId, patientId, encounterId)
      .then((records) => {
        if (active) {
          setEntries(records.toSorted(compareScheduledAt));
          setCanRefresh(false);
        }
      })
      .catch(() => {
        if (active) {
          setCanRefresh(true);
          setError(LOAD_ERROR);
        }
      })
      .finally(() => {
        if (active) setCompletedLoadAttempt(loadAttempt);
      });
    return () => {
      active = false;
    };
  }, [encounterId, loadAttempt, organisationId, patientId]);

  const reload = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);

  const clearError = useCallback(() => setError(null), []);

  const reportStaleData = useCallback((message: string) => {
    setCanRefresh(true);
    setError(message);
  }, []);

  const reportFailure = useCallback((message: string) => setError(message), []);

  const appendEntry = useCallback((entry: MedicationAdministrationEntry) => {
    setEntries((current) => [...current, entry].toSorted(compareScheduledAt));
  }, []);

  const applyOutcome = useCallback((entryId: string, entry: MedicationAdministrationEntry) => {
    setEntries((current) => current.map((row) => (row.id === entryId ? entry : row)));
  }, []);

  return {
    entries,
    isLoading,
    error,
    canRefresh,
    reload,
    clearError,
    reportStaleData,
    reportFailure,
    appendEntry,
    applyOutcome,
  };
};
