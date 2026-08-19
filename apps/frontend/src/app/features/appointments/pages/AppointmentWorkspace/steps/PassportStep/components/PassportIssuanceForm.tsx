'use client';
import React from 'react';
import type { IssuePassportRequestDTO } from '@yosemite-crew/types';
import {
  DraftFields,
  PassportFormFooter,
  usePassportCaptureForm,
  type DraftFieldSpec,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/passportFormKit';
import {
  buildPassportIssuancePayload,
  EMPTY_PASSPORT_ISSUANCE_DRAFT,
  validatePassportIssuanceDraft,
  type PassportIssuanceDraft,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportDrafts';

const ISSUANCE_FIELDS: ReadonlyArray<DraftFieldSpec<PassportIssuanceDraft>> = [
  { key: 'passportNumber', label: 'Passport number' },
  { key: 'issuingCountry', label: 'Issuing country' },
  { key: 'issuingAuthority', label: 'Issuing authority' },
  { key: 'issuingVetName', label: 'Issuing vet' },
  { key: 'issuingVetLicense', label: 'Issuing vet licence' },
];

type PassportIssuanceFormProps = {
  onSubmit: (payload: IssuePassportRequestDTO) => Promise<void>;
};

/**
 * Rendered only once the vet has opted in to issuing a passport, so it is never
 * a field the visit has to dismiss. It carries no card of its own - the opt-in
 * section owns the surface it appears in.
 */
const PassportIssuanceForm = ({ onSubmit }: PassportIssuanceFormProps) => {
  const { draft, errors, isSaving, submitError, setField, handleSubmit } = usePassportCaptureForm({
    initialDraft: EMPTY_PASSPORT_ISSUANCE_DRAFT,
    validate: validatePassportIssuanceDraft,
    buildPayload: buildPassportIssuancePayload,
    onSubmit,
  });

  return (
    <div className="flex flex-col gap-4">
      <DraftFields specs={ISSUANCE_FIELDS} draft={draft} errors={errors} onChange={setField} />
      <PassportFormFooter
        submitLabel="Issue passport"
        isSaving={isSaving}
        submitError={submitError}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default PassportIssuanceForm;
