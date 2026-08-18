'use client';
import React from 'react';
import type { RecordClinicalExamRequestDTO } from '@yosemite-crew/types';
import SegmentedPill, {
  type SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import {
  DraftFields,
  NotesField,
  PassportFormShell,
  usePassportCaptureForm,
  type DraftFieldSpec,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/passportFormKit';
import {
  buildClinicalExamPayload,
  EMPTY_CLINICAL_EXAM_DRAFT,
  validateClinicalExamDraft,
  type ClinicalExamDraft,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportDrafts';

const FIT_FOR_TRAVEL_OPTIONS: ReadonlyArray<
  SegmentedPillOption<ClinicalExamDraft['fitForTravel']>
> = [
  { value: 'YES', label: 'Fit for travel' },
  { value: 'NO', label: 'Not fit for travel' },
];

const EXAM_FIELDS: ReadonlyArray<DraftFieldSpec<ClinicalExamDraft>> = [
  { key: 'examinedAt', label: 'Examined at', type: 'datetime-local' },
  { key: 'weightKg', label: 'Weight (kg)', type: 'number' },
  { key: 'temperatureC', label: 'Temperature (°C)', type: 'number' },
];

type ClinicalExamCaptureFormProps = {
  onSubmit: (payload: RecordClinicalExamRequestDTO) => Promise<void>;
};

/**
 * The pre-travel clinical examination. "Fit for travel" is the vet's own
 * attestation, so it is the first decision on the form rather than a checkbox
 * buried under the findings.
 */
const ClinicalExamCaptureForm = ({ onSubmit }: ClinicalExamCaptureFormProps) => {
  const { draft, errors, isSaving, submitError, setField, handleSubmit } = usePassportCaptureForm({
    initialDraft: EMPTY_CLINICAL_EXAM_DRAFT,
    validate: validateClinicalExamDraft,
    buildPayload: buildClinicalExamPayload,
    onSubmit,
  });

  return (
    <PassportFormShell
      title="Fit-to-travel exam"
      description="Record the pre-travel examination and the fit-to-travel decision for this visit."
      submitLabel="Save exam"
      isSaving={isSaving}
      submitError={submitError}
      onSubmit={handleSubmit}
    >
      <SegmentedPill
        ariaLabel="Fit for travel"
        options={FIT_FOR_TRAVEL_OPTIONS}
        value={draft.fitForTravel}
        onChange={(value) => setField('fitForTravel', value)}
      />
      <DraftFields specs={EXAM_FIELDS} draft={draft} errors={errors} onChange={setField} />
      <NotesField
        label="Findings"
        value={draft.findings}
        onChange={(value) => setField('findings', value)}
      />
    </PassportFormShell>
  );
};

export default ClinicalExamCaptureForm;
