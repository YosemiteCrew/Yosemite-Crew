'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Text } from '@/app/ui';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';
import MedicationAdministrationHistory from './MedicationAdministrationHistory';
import ScheduleDoseForm from './ScheduleDoseForm';
import {
  createMedicationAdministration,
  listMedicationAdministrations,
  recordMedicationOutcome,
  type MedicationAdministrationEntry,
  type MedicationAdministrationOutcome,
} from '@/app/features/appointments/services/medicationAdministrationService';

type MedicationAdministrationPanelProps = {
  organisationId?: string;
  patientId?: string;
  encounterId?: string;
  prescriptions: PrescriptionItem[];
  readOnly: boolean;
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

  const saveScheduledDose = async (event: React.SubmitEvent<HTMLFormElement>) => {
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

  const saveOutcome = async (entryId: string, outcome: MedicationAdministrationOutcome) => {
    if (!organisationId || isSaving) return;
    setSavingEntryId(entryId);
    setIsSaving(true);
    setError(null);
    try {
      const updated = await recordMedicationOutcome(organisationId, entryId, outcome);
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
          <MedicationAdministrationHistory
            entries={entries}
            readOnly={readOnly}
            isSaving={isSaving}
            savingEntryId={savingEntryId}
            onRecordOutcome={saveOutcome}
          />
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
          <ScheduleDoseForm
            schedulablePrescriptions={schedulablePrescriptions}
            selectedPrescription={selectedPrescription}
            prescriptionId={prescriptionId}
            scheduledAt={scheduledAt}
            isSaving={isSaving}
            onPrescriptionChange={setPrescriptionId}
            onScheduledAtChange={setScheduledAt}
            onSubmit={saveScheduledDose}
            onCancel={resetForm}
          />
        )}
      </div>
    </SectionContainer>
  );
};

export default MedicationAdministrationPanel;
