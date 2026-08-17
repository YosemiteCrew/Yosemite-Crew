'use client';
import React from 'react';
import type { RecordVaccinationRequestDTO, VaccineType } from '@yosemite-crew/types';
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
  buildVaccinationPayload,
  EMPTY_VACCINATION_DRAFT,
  validateVaccinationDraft,
  type VaccinationDraft,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportDrafts';
import { VACCINE_TYPE_LABELS } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportRecordRows';

const VACCINE_TYPE_OPTIONS: ReadonlyArray<SegmentedPillOption<VaccineType>> = [
  { value: 'RABIES', label: VACCINE_TYPE_LABELS.RABIES },
  { value: 'CORE', label: VACCINE_TYPE_LABELS.CORE },
  { value: 'NON_CORE', label: VACCINE_TYPE_LABELS.NON_CORE },
  { value: 'OTHER', label: VACCINE_TYPE_LABELS.OTHER },
];

const VACCINATION_FIELDS: ReadonlyArray<DraftFieldSpec<VaccinationDraft>> = [
  { key: 'vaccineName', label: 'Vaccine name' },
  { key: 'dateAdministered', label: 'Date administered', type: 'date' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'batchNumber', label: 'Batch number' },
  { key: 'lotNumber', label: 'Lot number' },
  { key: 'validFrom', label: 'Valid from', type: 'date' },
  { key: 'validUntil', label: 'Valid until', type: 'date' },
  { key: 'nextDueDate', label: 'Next due', type: 'date' },
  { key: 'administeringVetName', label: 'Administering vet' },
  { key: 'vetLicenseNumber', label: 'Vet licence number' },
  { key: 'site', label: 'Injection site' },
  { key: 'route', label: 'Route' },
];

type VaccinationCaptureFormProps = {
  onSubmit: (payload: RecordVaccinationRequestDTO) => Promise<void>;
};

/** Immunization capture. A rabies dose is what drives passport validity. */
const VaccinationCaptureForm = ({ onSubmit }: VaccinationCaptureFormProps) => {
  const { draft, errors, isSaving, submitError, setField, handleSubmit } = usePassportCaptureForm({
    initialDraft: EMPTY_VACCINATION_DRAFT,
    validate: validateVaccinationDraft,
    buildPayload: buildVaccinationPayload,
    onSubmit,
  });

  return (
    <PassportFormShell
      title="Vaccination"
      description="Record an administered dose. A rabies dose drives passport validity, so its batch and validity window belong on the record."
      submitLabel="Save vaccination"
      isSaving={isSaving}
      submitError={submitError}
      onSubmit={handleSubmit}
    >
      <SegmentedPill
        ariaLabel="Vaccine type"
        options={VACCINE_TYPE_OPTIONS}
        value={draft.vaccineType}
        onChange={(value) => setField('vaccineType', value)}
      />
      <DraftFields specs={VACCINATION_FIELDS} draft={draft} errors={errors} onChange={setField} />
      <NotesField
        label="Notes"
        value={draft.notes}
        onChange={(value) => setField('notes', value)}
      />
    </PassportFormShell>
  );
};

export default VaccinationCaptureForm;
