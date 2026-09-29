'use client';

import { useState, type FormEvent } from 'react';
import { Button, Text } from '@/app/ui';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';
import {
  createMedicationAdministration,
  type MedicationAdministrationEntry,
} from '@/app/features/appointments/services/medicationAdministrationService';

type ScheduleDoseFormProps = {
  organisationId: string;
  patientId: string;
  encounterId: string;
  /** In-house prescriptions that carry both a dose and a route. */
  schedulablePrescriptions: PrescriptionItem[];
  /** True while any write for this panel is in flight, not just this form's. */
  isSaving: boolean;
  onStartSaving: () => void;
  onStopSaving: () => void;
  onCancel: () => void;
  onScheduled: (entry: MedicationAdministrationEntry) => void;
  onFailed: (message: string) => void;
};

const prescriptionOptionLabel = (item: PrescriptionItem) =>
  `${item.medicineName} · ${item.dose ?? ''} ${item.doseUnit ?? ''} · ${item.route ?? ''}`;

const doseLabel = (item: PrescriptionItem) => [item.dose, item.doseUnit].filter(Boolean).join(' ');

/**
 * Schedule one dose against an in-house prescription.
 *
 * The saved entry is handed back so the panel can add it to the history in
 * scheduled order, which is why this form never refetches the list itself.
 */
const ScheduleDoseForm = ({
  organisationId,
  patientId,
  encounterId,
  schedulablePrescriptions,
  isSaving,
  onStartSaving,
  onStopSaving,
  onCancel,
  onScheduled,
  onFailed,
}: ScheduleDoseFormProps) => {
  const [prescriptionId, setPrescriptionId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const selectedPrescription = schedulablePrescriptions.find((item) => item.id === prescriptionId);

  const saveScheduledDose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPrescription || !scheduledAt) return;
    onStartSaving();
    try {
      const entry = await createMedicationAdministration({
        organisationId,
        patientId,
        encounterId,
        ...(selectedPrescription.labelPrescriptionId
          ? { prescriptionId: selectedPrescription.labelPrescriptionId }
          : {}),
        medicationName: selectedPrescription.medicineName,
        dose: doseLabel(selectedPrescription),
        route: selectedPrescription.route ?? '',
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      onScheduled(entry);
    } catch {
      onFailed('Unable to schedule this dose. Please try again.');
    } finally {
      onStopSaving();
    }
  };

  return (
    <form
      onSubmit={saveScheduledDose}
      className="flex flex-col gap-3 rounded-xl border border-card-border p-4"
    >
      <label className="flex flex-col gap-1 text-body-4 font-medium text-text-primary">
        {'Medication'}
        <select
          required
          value={prescriptionId}
          onChange={(event) => setPrescriptionId(event.target.value)}
          className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
        >
          <option value="">Choose an in-house prescription</option>
          {schedulablePrescriptions.map((item) => (
            <option key={item.id} value={item.id}>
              {prescriptionOptionLabel(item)}
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
        {'Scheduled time'}
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
        <Button text="Cancel" variant="secondary" onClick={onCancel} isDisabled={isSaving} />
      </div>
    </form>
  );
};

export default ScheduleDoseForm;
