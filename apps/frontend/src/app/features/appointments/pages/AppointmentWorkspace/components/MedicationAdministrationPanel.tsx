'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Text } from '@/app/ui';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';
import {
  administerMedication,
  createMedicationAdministration,
  holdMedication,
  listMedicationAdministrations,
  missMedication,
  refuseMedication,
  type MedicationAdministrationEntry,
  type MedicationAdministrationStatus,
} from '@/app/features/appointments/services/medicationAdministrationService';

type MedicationAdministrationPanelProps = {
  organisationId?: string;
  patientId?: string;
  encounterId?: string;
  prescriptions: PrescriptionItem[];
  readOnly: boolean;
};

type OutcomeAction = (
  organisationId: string,
  entryId: string
) => Promise<MedicationAdministrationEntry>;

const STATUS_LABELS: Record<MedicationAdministrationStatus, string> = {
  SCHEDULED: 'Scheduled',
  GIVEN: 'Given',
  HELD: 'Held',
  MISSED: 'Missed',
  REFUSED: 'Refused',
};

const STATUS_TONES: Record<MedicationAdministrationStatus, StatusTone> = {
  SCHEDULED: 'info',
  GIVEN: 'success',
  HELD: 'warning',
  MISSED: 'danger',
  REFUSED: 'neutral',
};

const compareScheduledAt = (a: MedicationAdministrationEntry, b: MedicationAdministrationEntry) =>
  a.scheduledAt.localeCompare(b.scheduledAt);

const MedicationAdministrationPanel = ({
  organisationId,
  patientId,
  encounterId,
  prescriptions,
  readOnly,
}: MedicationAdministrationPanelProps) => {
  const [entries, setEntries] = useState<MedicationAdministrationEntry[]>([]);
  const [completedLoadAttempt, setCompletedLoadAttempt] = useState<number | null>(null);
  const [canRefresh, setCanRefresh] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [prescriptionId, setPrescriptionId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const schedulablePrescriptions = useMemo(
    () =>
      prescriptions.filter(
        (item) =>
          item.fulfillment === 'IN_HOUSE' &&
          item.medicineName.trim() &&
          item.dose?.trim() &&
          item.route?.trim()
      ),
    [prescriptions]
  );
  const selectedPrescription = schedulablePrescriptions.find((item) => item.id === prescriptionId);
  const ready = Boolean(organisationId && patientId && encounterId);
  const isLoading = ready && completedLoadAttempt !== loadAttempt;

  useEffect(() => {
    if (!ready || !organisationId || !patientId || !encounterId) return;
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
          setError('Unable to load medication history. Please try again.');
        }
      })
      .finally(() => {
        if (active) setCompletedLoadAttempt(loadAttempt);
      });
    return () => {
      active = false;
    };
  }, [encounterId, loadAttempt, organisationId, patientId, ready]);

  const resetForm = () => {
    setIsCreating(false);
    setPrescriptionId('');
    setScheduledAt('');
  };

  const saveScheduledDose = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organisationId || !patientId || !encounterId || !selectedPrescription || !scheduledAt) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const dose = [selectedPrescription.dose, selectedPrescription.doseUnit]
        .filter(Boolean)
        .join(' ');
      const entry = await createMedicationAdministration({
        organisationId,
        patientId,
        encounterId,
        ...(selectedPrescription.labelPrescriptionId
          ? { prescriptionId: selectedPrescription.labelPrescriptionId }
          : {}),
        medicationName: selectedPrescription.medicineName,
        dose,
        route: selectedPrescription.route ?? '',
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setEntries((current) => [...current, entry].toSorted(compareScheduledAt));
      resetForm();
    } catch {
      setError('Unable to schedule this dose. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveOutcome = async (entryId: string, action: OutcomeAction) => {
    if (!organisationId || isSaving) return;
    setSavingEntryId(entryId);
    setIsSaving(true);
    setError(null);
    try {
      const updated = await action(organisationId, entryId);
      setEntries((current) => current.map((entry) => (entry.id === entryId ? updated : entry)));
    } catch {
      setCanRefresh(true);
      setError('Unable to record this outcome. Refresh the history to see its current state.');
    } finally {
      setSavingEntryId(null);
      setIsSaving(false);
    }
  };

  return (
    <SectionContainer title="Medication administration" className="min-w-0">
      <div className="flex flex-col gap-4">
        {!ready && (
          <Text as="p" variant="body-4" className="text-text-secondary">
            Medication history will be available once the inpatient record is loaded.
          </Text>
        )}

        {isLoading && (
          <Text as="p" variant="body-4" role="status" className="text-text-secondary">
            Loading medication history…
          </Text>
        )}

        {error && (
          <div className="flex flex-wrap items-center gap-3">
            <Text as="p" variant="body-4" role="alert" className="text-text-error">
              {error}
            </Text>
            {canRefresh && (
              <Button
                text="Refresh"
                variant="secondary"
                onClick={() => {
                  setError(null);
                  setCanRefresh(false);
                  setLoadAttempt((attempt) => attempt + 1);
                }}
                isDisabled={isSaving}
              />
            )}
          </div>
        )}

        {!isLoading && ready && entries.length === 0 && (
          <Text as="p" variant="body-4" className="text-text-secondary">
            No medication doses are scheduled for this inpatient stay.
          </Text>
        )}

        {ready && entries.length > 0 && (
          <ul className="flex flex-col divide-y divide-card-border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Text as="h3" variant="body-3-emphasis" className="text-text-primary">
                      {entry.medicationName}
                    </Text>
                    <Text as="p" variant="body-4" className="mt-1 text-text-secondary">
                      {entry.dose} · {entry.route} · {formatStampDate(entry.scheduledAt)}
                    </Text>
                    {entry.status !== 'SCHEDULED' && (
                      <Text as="p" variant="caption-1" className="mt-1 text-text-secondary">
                        {entry.status === 'GIVEN' ? 'Recorded as given' : 'Outcome recorded'} ·{' '}
                        {formatStampDate(entry.administeredAt ?? entry.updatedAt)}
                      </Text>
                    )}
                    {entry.notes && (
                      <Text as="p" variant="caption-1" className="mt-1 text-text-secondary">
                        {entry.notes}
                      </Text>
                    )}
                  </div>
                  <StatusPill
                    label={STATUS_LABELS[entry.status]}
                    tone={STATUS_TONES[entry.status]}
                    className="mt-0.5"
                  />
                </div>
                {entry.status === 'SCHEDULED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      text={savingEntryId === entry.id ? 'Saving…' : 'Record given'}
                      onClick={() => saveOutcome(entry.id, administerMedication)}
                      isDisabled={readOnly || isSaving}
                    />
                    <Button
                      text="Hold"
                      variant="secondary"
                      onClick={() => saveOutcome(entry.id, holdMedication)}
                      isDisabled={readOnly || isSaving}
                    />
                    <Button
                      text="Mark missed"
                      variant="secondary"
                      onClick={() => saveOutcome(entry.id, missMedication)}
                      isDisabled={readOnly || isSaving}
                    />
                    <Button
                      text="Record refused"
                      variant="secondary"
                      onClick={() => saveOutcome(entry.id, refuseMedication)}
                      isDisabled={readOnly || isSaving}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && ready && !isCreating && (
          <Button
            text="Schedule a dose"
            variant="secondary"
            onClick={() => setIsCreating(true)}
            isDisabled={schedulablePrescriptions.length === 0}
          />
        )}

        {!readOnly && ready && schedulablePrescriptions.length === 0 && (
          <Text as="p" variant="caption-1" className="text-text-secondary">
            Add an in-house prescription with a dose and route before scheduling a dose.
          </Text>
        )}

        {isCreating && (
          <form
            onSubmit={saveScheduledDose}
            className="flex flex-col gap-3 rounded-xl border border-card-border p-4"
          >
            <label className="flex flex-col gap-1 text-body-4 font-medium text-text-primary">
              Medication
              <select
                required
                value={prescriptionId}
                onChange={(event) => setPrescriptionId(event.target.value)}
                className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
              >
                <option value="">Choose an in-house prescription</option>
                {schedulablePrescriptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.medicineName} · {item.dose ?? ''} {item.doseUnit ?? ''} ·{' '}
                    {item.route ?? ''}
                  </option>
                ))}
              </select>
            </label>
            {selectedPrescription && (
              <Text variant="caption-1" className="text-text-secondary">
                {selectedPrescription.instructions || 'Use the directions on the prescription.'}
              </Text>
            )}
            <label className="flex flex-col gap-1 text-body-4 font-medium text-text-primary">
              Scheduled time
              <input
                required
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                text={isSaving ? 'Saving…' : 'Save scheduled dose'}
                type="submit"
                isDisabled={isSaving}
              />
              <Button text="Cancel" variant="secondary" onClick={resetForm} isDisabled={isSaving} />
            </div>
          </form>
        )}
      </div>
    </SectionContainer>
  );
};

export default MedicationAdministrationPanel;
