'use client';
import React from 'react';
import type { RecordRabiesTitrationRequestDTO } from '@yosemite-crew/types';
import {
  DraftFields,
  PassportFormShell,
  usePassportCaptureForm,
  type DraftFieldSpec,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/passportFormKit';
import {
  buildRabiesTitrationPayload,
  EMPTY_RABIES_TITRATION_DRAFT,
  validateRabiesTitrationDraft,
  type RabiesTitrationDraft,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportDrafts';

const TITRATION_FIELDS: ReadonlyArray<DraftFieldSpec<RabiesTitrationDraft>> = [
  { key: 'approvedLab', label: 'Approved laboratory' },
  { key: 'sampleDate', label: 'Sample date', type: 'date' },
  { key: 'resultIuMl', label: 'Result (IU/ml)', type: 'number' },
  { key: 'reportUrl', label: 'Report link', type: 'url' },
];

type RabiesTitrationCaptureFormProps = {
  onSubmit: (payload: RecordRabiesTitrationRequestDTO) => Promise<void>;
};

/**
 * Rabies antibody titration. Non-listed destinations require a result of at
 * least 0.5 IU/ml from an approved laboratory, so the lab and the sample date
 * are as load-bearing as the titre itself.
 */
const RabiesTitrationCaptureForm = ({ onSubmit }: RabiesTitrationCaptureFormProps) => {
  const { draft, errors, isSaving, submitError, setField, handleSubmit } = usePassportCaptureForm({
    initialDraft: EMPTY_RABIES_TITRATION_DRAFT,
    validate: validateRabiesTitrationDraft,
    buildPayload: buildRabiesTitrationPayload,
    onSubmit,
  });

  return (
    <PassportFormShell
      title="Rabies titration"
      description="Record the antibody titration result. The sample must come from an approved laboratory."
      submitLabel="Save titration"
      isSaving={isSaving}
      submitError={submitError}
      onSubmit={handleSubmit}
    >
      <DraftFields specs={TITRATION_FIELDS} draft={draft} errors={errors} onChange={setField} />
    </PassportFormShell>
  );
};

export default RabiesTitrationCaptureForm;
