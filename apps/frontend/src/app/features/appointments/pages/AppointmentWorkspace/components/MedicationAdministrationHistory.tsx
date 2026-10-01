'use client';

import { Button, Text } from '@/app/ui';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';
import {
  type MedicationAdministrationEntry,
  type MedicationAdministrationOutcome,
  type MedicationAdministrationStatus,
} from '@/app/features/appointments/services/medicationAdministrationService';

type MedicationAdministrationHistoryProps = {
  entries: MedicationAdministrationEntry[];
  readOnly: boolean;
  isSaving: boolean;
  savingEntryId: string | null;
  onRecordOutcome: (entryId: string, outcome: MedicationAdministrationOutcome) => void;
};

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

const OUTCOME_ACTIONS: readonly {
  outcome: MedicationAdministrationOutcome;
  label: string;
  variant?: 'secondary';
}[] = [
  { outcome: 'GIVEN', label: 'Record given' },
  { outcome: 'HELD', label: 'Hold', variant: 'secondary' },
  { outcome: 'MISSED', label: 'Mark missed', variant: 'secondary' },
  { outcome: 'REFUSED', label: 'Record refused', variant: 'secondary' },
];

const MedicationAdministrationHistory = ({
  entries,
  readOnly,
  isSaving,
  savingEntryId,
  onRecordOutcome,
}: MedicationAdministrationHistoryProps) => (
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
            {OUTCOME_ACTIONS.map((action) => (
              <Button
                key={action.outcome}
                text={
                  savingEntryId === entry.id && action.outcome === 'GIVEN'
                    ? 'Saving…'
                    : action.label
                }
                variant={action.variant}
                onClick={() => onRecordOutcome(entry.id, action.outcome)}
                isDisabled={readOnly || isSaving}
              />
            ))}
          </div>
        )}
      </li>
    ))}
  </ul>
);

export default MedicationAdministrationHistory;
