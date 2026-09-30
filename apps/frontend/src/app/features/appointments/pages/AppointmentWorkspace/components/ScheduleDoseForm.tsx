'use client';

import { Button, Text } from '@/app/ui';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';

type ScheduleDoseFormProps = {
  schedulablePrescriptions: PrescriptionItem[];
  selectedPrescription: PrescriptionItem | undefined;
  prescriptionId: string;
  scheduledAt: string;
  isSaving: boolean;
  onPrescriptionChange: (prescriptionId: string) => void;
  onScheduledAtChange: (scheduledAt: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

const ScheduleDoseForm = ({
  schedulablePrescriptions,
  selectedPrescription,
  prescriptionId,
  scheduledAt,
  isSaving,
  onPrescriptionChange,
  onScheduledAtChange,
  onSubmit,
  onCancel,
}: ScheduleDoseFormProps) => (
  <form
    onSubmit={onSubmit}
    className="flex flex-col gap-3 rounded-xl border border-card-border p-4"
  >
    <label className="flex flex-col gap-1 text-body-4 font-medium text-text-primary">
      {'Medication'}
      <select
        required
        value={prescriptionId}
        onChange={(event) => onPrescriptionChange(event.target.value)}
        className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
      >
        <option value="">Choose an in-house prescription</option>
        {schedulablePrescriptions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.medicineName} · {item.dose ?? ''} {item.doseUnit ?? ''} · {item.route ?? ''}
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
        onChange={(event) => onScheduledAtChange(event.target.value)}
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

export default ScheduleDoseForm;
