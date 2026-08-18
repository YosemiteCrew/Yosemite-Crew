'use client';
import React from 'react';
import type {
  ParasiteTreatmentType,
  RecordParasiteTreatmentRequestDTO,
} from '@yosemite-crew/types';
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
  buildParasiteTreatmentPayload,
  EMPTY_PARASITE_TREATMENT_DRAFT,
  validateParasiteTreatmentDraft,
  type ParasiteTreatmentDraft,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportDrafts';
import { PARASITE_TREATMENT_TYPE_LABELS } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportRecordRows';

const TREATMENT_TYPE_OPTIONS: ReadonlyArray<SegmentedPillOption<ParasiteTreatmentType>> = [
  { value: 'ECHINOCOCCUS', label: PARASITE_TREATMENT_TYPE_LABELS.ECHINOCOCCUS },
  { value: 'TICK', label: PARASITE_TREATMENT_TYPE_LABELS.TICK },
  { value: 'FLEA', label: PARASITE_TREATMENT_TYPE_LABELS.FLEA },
  { value: 'OTHER', label: PARASITE_TREATMENT_TYPE_LABELS.OTHER },
];

const TREATMENT_FIELDS: ReadonlyArray<DraftFieldSpec<ParasiteTreatmentDraft>> = [
  { key: 'productName', label: 'Product name' },
  { key: 'treatedAt', label: 'Treated at', type: 'datetime-local' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'administeringVetName', label: 'Administering vet' },
];

type ParasiteTreatmentCaptureFormProps = {
  onSubmit: (payload: RecordParasiteTreatmentRequestDTO) => Promise<void>;
};

/**
 * Anti-parasite treatment capture. The echinococcus (tapeworm) dose is the one
 * entry destinations check to the hour, so the treatment time is captured too.
 */
const ParasiteTreatmentCaptureForm = ({ onSubmit }: ParasiteTreatmentCaptureFormProps) => {
  const { draft, errors, isSaving, submitError, setField, handleSubmit } = usePassportCaptureForm({
    initialDraft: EMPTY_PARASITE_TREATMENT_DRAFT,
    validate: validateParasiteTreatmentDraft,
    buildPayload: buildParasiteTreatmentPayload,
    onSubmit,
  });

  return (
    <PassportFormShell
      title="Parasite treatment"
      description="Record an anti-parasite dose. Echinococcus treatment is time-sensitive, so the exact treatment time is recorded with it."
      submitLabel="Save treatment"
      isSaving={isSaving}
      submitError={submitError}
      onSubmit={handleSubmit}
    >
      <SegmentedPill
        ariaLabel="Treatment type"
        options={TREATMENT_TYPE_OPTIONS}
        value={draft.treatmentType}
        onChange={(value) => setField('treatmentType', value)}
      />
      <DraftFields specs={TREATMENT_FIELDS} draft={draft} errors={errors} onChange={setField} />
      <NotesField
        label="Notes"
        value={draft.notes}
        onChange={(value) => setField('notes', value)}
      />
    </PassportFormShell>
  );
};

export default ParasiteTreatmentCaptureForm;
