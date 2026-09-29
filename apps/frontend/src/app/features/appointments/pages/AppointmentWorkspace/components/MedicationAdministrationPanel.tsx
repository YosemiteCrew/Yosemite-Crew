'use client';

import { useMemo, useState } from 'react';
import { Button, Text } from '@/app/ui';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';
import { useMedicationHistory } from '@/app/features/appointments/hooks/useMedicationHistory';
import type { MedicationOutcomeAction } from './medicationOutcomes';
import MedicationHistoryList from './MedicationHistoryList';
import MedicationHistoryStatus from './MedicationHistoryStatus';
import ScheduleDoseForm from './ScheduleDoseForm';

type MedicationAdministrationPanelProps = {
  organisationId?: string;
  patientId?: string;
  encounterId?: string;
  prescriptions: PrescriptionItem[];
  readOnly: boolean;
};

const OUTCOME_FAILED =
  'Unable to record this outcome. Refresh the history to see its current state.';

/** The dose and button a nurse is waiting on, so only that one reads "Saving…". */
type SavingOutcome = { entryId: string; label: string };

/** A dose can only be scheduled from a prescription the practice holds in house. */
const isSchedulablePrescription = (item: PrescriptionItem) =>
  item.fulfillment === 'IN_HOUSE' &&
  Boolean(item.medicineName.trim() && item.dose?.trim() && item.route?.trim());

const MedicationAdministrationPanel = ({
  organisationId,
  patientId,
  encounterId,
  prescriptions,
  readOnly,
}: MedicationAdministrationPanelProps) => {
  const history = useMedicationHistory(organisationId, patientId, encounterId);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState<SavingOutcome | null>(null);

  const schedulablePrescriptions = useMemo(
    () => prescriptions.filter(isSchedulablePrescription),
    [prescriptions]
  );
  const ready = Boolean(organisationId && patientId && encounterId);
  const canSchedule = schedulablePrescriptions.length > 0;

  const recordOutcome = async (entryId: string, label: string, action: MedicationOutcomeAction) => {
    if (!organisationId || isSaving) return;
    setSavingOutcome({ entryId, label });
    setIsSaving(true);
    history.clearError();
    try {
      history.applyOutcome(entryId, await action(organisationId, entryId));
    } catch {
      history.reportStaleData(OUTCOME_FAILED);
    } finally {
      setSavingOutcome(null);
      setIsSaving(false);
    }
  };

  return (
    <SectionContainer title="Medication administration" className="min-w-0">
      <div className="flex flex-col gap-4">
        <MedicationHistoryStatus
          ready={ready}
          isLoading={history.isLoading}
          isEmpty={history.entries.length === 0}
          error={history.error}
          canRefresh={history.canRefresh}
          isBusy={isSaving}
          onRefresh={() => {
            history.clearError();
            history.reload();
          }}
        />

        {ready && history.entries.length > 0 && (
          <MedicationHistoryList
            entries={history.entries}
            readOnly={readOnly}
            isSaving={isSaving}
            saving={savingOutcome}
            onRecordOutcome={recordOutcome}
          />
        )}

        {!readOnly && ready && !isCreating && (
          <Button
            text="Schedule a dose"
            variant="secondary"
            onClick={() => setIsCreating(true)}
            isDisabled={!canSchedule}
          />
        )}

        {!readOnly && ready && !canSchedule && (
          <Text as="p" variant="caption-1" className="text-text-secondary">
            Add an in-house prescription with a dose and route before scheduling a dose.
          </Text>
        )}

        {isCreating && organisationId && patientId && encounterId && (
          <ScheduleDoseForm
            organisationId={organisationId}
            patientId={patientId}
            encounterId={encounterId}
            schedulablePrescriptions={schedulablePrescriptions}
            isSaving={isSaving}
            onStartSaving={() => {
              history.clearError();
              setIsSaving(true);
            }}
            onStopSaving={() => setIsSaving(false)}
            onCancel={() => setIsCreating(false)}
            onScheduled={(entry) => {
              history.appendEntry(entry);
              setIsCreating(false);
            }}
            onFailed={history.reportFailure}
          />
        )}
      </div>
    </SectionContainer>
  );
};

export default MedicationAdministrationPanel;
