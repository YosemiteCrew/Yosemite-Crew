'use client';

import { Button, Text } from '@/app/ui';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';
import type { MedicationAdministrationEntry } from '@/app/features/appointments/services/medicationAdministrationService';
import { MEDICATION_OUTCOMES, type MedicationOutcomeAction } from './medicationOutcomes';

type MedicationHistoryListProps = {
  entries: MedicationAdministrationEntry[];
  readOnly: boolean;
  /** True while any write on the panel is in flight, which disables every action. */
  isSaving: boolean;
  /** The dose and button currently being written, if any. */
  saving: { entryId: string; label: string } | null;
  onRecordOutcome: (entryId: string, label: string, action: MedicationOutcomeAction) => void;
};

type MedicationHistoryRowProps = Omit<MedicationHistoryListProps, 'entries'> & {
  entry: MedicationAdministrationEntry;
};

const STATUS_LABELS: Record<MedicationAdministrationEntry['status'], string> = {
  SCHEDULED: 'Scheduled',
  GIVEN: 'Given',
  HELD: 'Held',
  MISSED: 'Missed',
  REFUSED: 'Refused',
};

const STATUS_TONES: Record<MedicationAdministrationEntry['status'], StatusTone> = {
  SCHEDULED: 'info',
  GIVEN: 'success',
  HELD: 'warning',
  MISSED: 'danger',
  REFUSED: 'neutral',
};

/** The line a nurse reads under a dose that is no longer waiting to be given. */
const recordedOutcomeLine = (entry: MedicationAdministrationEntry) =>
  entry.status === 'GIVEN' ? 'Recorded as given' : 'Outcome recorded';

const MedicationHistoryRow = ({
  entry,
  readOnly,
  isSaving,
  saving,
  onRecordOutcome,
}: MedicationHistoryRowProps) => {
  const isScheduled = entry.status === 'SCHEDULED';
  const savingLabel = saving?.entryId === entry.id ? saving.label : null;

  return (
    <li className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Text as="h3" variant="body-3-emphasis" className="text-text-primary">
            {entry.medicationName}
          </Text>
          <Text as="p" variant="body-4" className="mt-1 text-text-secondary">
            {entry.dose} · {entry.route} · {formatStampDate(entry.scheduledAt)}
          </Text>
          {!isScheduled && (
            <Text as="p" variant="caption-1" className="mt-1 text-text-secondary">
              {recordedOutcomeLine(entry)} ·{' '}
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
      {isScheduled && (
        <div className="flex flex-wrap gap-2">
          {MEDICATION_OUTCOMES.map((outcome) => (
            <Button
              key={outcome.label}
              text={savingLabel === outcome.label ? 'Saving…' : outcome.label}
              variant={outcome.variant}
              onClick={() => onRecordOutcome(entry.id, outcome.label, outcome.action)}
              isDisabled={readOnly || isSaving}
            />
          ))}
        </div>
      )}
    </li>
  );
};

/** The encounter's recorded doses, earliest scheduled time first. */
const MedicationHistoryList = ({
  entries,
  readOnly,
  isSaving,
  saving,
  onRecordOutcome,
}: MedicationHistoryListProps) => (
  <ul className="flex flex-col divide-y divide-card-border">
    {entries.map((entry) => (
      <MedicationHistoryRow
        key={entry.id}
        entry={entry}
        readOnly={readOnly}
        isSaving={isSaving}
        saving={saving}
        onRecordOutcome={onRecordOutcome}
      />
    ))}
  </ul>
);

export default MedicationHistoryList;
