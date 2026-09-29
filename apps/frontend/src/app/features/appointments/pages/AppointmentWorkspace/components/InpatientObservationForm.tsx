// no-story: Exercised through InpatientMonitoringPanel.stories.tsx as part of the panel flow.
import type { FormEvent } from 'react';
import { Button, Text, Textarea } from '@/app/ui';
import { MEASUREMENT_FIELDS } from './inpatientObservationFields';

type InpatientObservationFormProps = {
  defaultObservedAt: string;
  isSaving: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancel: () => void;
};

const InpatientObservationForm = ({
  defaultObservedAt,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: InpatientObservationFormProps) => (
  <form
    onSubmit={onSubmit}
    className="grid grid-cols-1 gap-3 rounded-xl border border-card-border p-4 sm:grid-cols-2"
  >
    <label className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary sm:col-span-2">
      <span>Observed at</span>
      <input
        required
        name="observedAt"
        type="datetime-local"
        defaultValue={defaultObservedAt}
        className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
      />
    </label>
    {MEASUREMENT_FIELDS.map(({ name, label, min, max, step }) => (
      <label
        key={name}
        className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary"
      >
        {label}
        <input
          name={name}
          type="number"
          min={min}
          max={max}
          step={step}
          className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
        />
      </label>
    ))}
    <label className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary sm:col-span-2">
      {'Notes'}
      <Textarea name="notes" maxLength={2000} rows={3} className="bg-[var(--screen)] text-body-4" />
    </label>
    {error && (
      <Text as="p" variant="body-4" role="alert" className="text-text-error sm:col-span-2">
        {error}
      </Text>
    )}
    <div className="flex flex-wrap gap-2 sm:col-span-2">
      <Button
        text={isSaving ? 'Saving…' : 'Save observation'}
        type="submit"
        isDisabled={isSaving}
      />
      <Button text="Cancel" variant="secondary" onClick={onCancel} isDisabled={isSaving} />
    </div>
  </form>
);

export default InpatientObservationForm;
