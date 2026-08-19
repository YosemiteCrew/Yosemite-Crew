'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  IssuePassportRequestDTO,
  PetPassportIssuanceDTO,
  RecordClinicalExamRequestDTO,
  RecordParasiteTreatmentRequestDTO,
  RecordRabiesTitrationRequestDTO,
  RecordVaccinationRequestDTO,
} from '@yosemite-crew/types';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import SegmentedPill, {
  type SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import { getPetPassport } from '@/app/features/petPassport/services/petPassport.service';
import {
  issuePassport,
  recordClinicalExam,
  recordImmunization,
  recordParasiteTreatment,
  recordRabiesTitration,
} from '@/app/features/petPassport/services/passportRecords.service';
import {
  buildSignedRecordRows,
  PASSPORT_RECORD_KIND_LABELS,
  toClinicalExamRow,
  toParasiteTreatmentRow,
  toRabiesTitrationRow,
  toVaccinationRow,
  type PassportRecordKind,
  type PassportRecordRow,
  type PassportRecordStatus,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportRecordRows';
import { getPassportErrorMessage } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportErrorMessage';
import PassportIssuanceSection from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/PassportIssuanceSection';
import CapturedRecordsList from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/CapturedRecordsList';
import VaccinationCaptureForm from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/VaccinationCaptureForm';
import RabiesTitrationCaptureForm from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/RabiesTitrationCaptureForm';
import ParasiteTreatmentCaptureForm from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/ParasiteTreatmentCaptureForm';
import ClinicalExamCaptureForm from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/components/ClinicalExamCaptureForm';

const RECORD_KIND_OPTIONS: ReadonlyArray<SegmentedPillOption<PassportRecordKind>> = [
  { value: 'VACCINATION', label: PASSPORT_RECORD_KIND_LABELS.VACCINATION },
  { value: 'TITRATION', label: PASSPORT_RECORD_KIND_LABELS.TITRATION },
  { value: 'TREATMENT', label: PASSPORT_RECORD_KIND_LABELS.TREATMENT },
  { value: 'EXAM', label: PASSPORT_RECORD_KIND_LABELS.EXAM },
];

const MISSING_ENCOUNTER_MESSAGE =
  'This appointment does not have an encounter yet. Check the patient in, then try again.';

const LOAD_ERROR_MESSAGE = 'Unable to load the passport for this companion.';

const LockedCaptureNotice = () => (
  <SectionContainer title="Capture a record">
    <p className="text-[12.5px] leading-[140%] text-(--ink-muted)">
      This visit is locked, so no further passport records can be captured against it.
    </p>
  </SectionContainer>
);

type PassportStepProps = {
  companionId: string;
  companionName: string;
  /** Encounter the captured records hang off; resolved on demand when absent. */
  encounterId?: string;
  ensureEncounterId?: () => Promise<string | undefined>;
  readOnly?: boolean;
};

/**
 * Passport step: the four record kinds a Digital Pet Passport is assembled from,
 * captured against this appointment's encounter, plus the opt-in issuance of the
 * passport itself. Signing and attestation are deliberately not offered here -
 * capture is what a visit does; attestation is a separate veterinarian act.
 */
const PassportStep = ({
  companionId,
  companionName,
  encounterId,
  ensureEncounterId,
  readOnly = false,
}: PassportStepProps) => {
  const [signedRows, setSignedRows] = useState<PassportRecordRow[]>([]);
  const [capturedRows, setCapturedRows] = useState<PassportRecordRow[]>([]);
  const [issuance, setIssuance] = useState<PetPassportIssuanceDTO | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<PassportRecordKind>('VACCINATION');

  // The step is mounted per companion, so the passport is read once. `isLoading`
  // starts true and is only ever cleared here - setting it synchronously in the
  // effect body would just add a cascading render.
  useEffect(() => {
    getPetPassport(companionId)
      .then((passport) => {
        setSignedRows(buildSignedRecordRows(passport));
        setIssuance(passport.issuance);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        setLoadError(getPassportErrorMessage(error, LOAD_ERROR_MESSAGE));
      })
      .finally(() => setIsLoading(false));
  }, [companionId]);

  const resolveEncounterId = useCallback(async (): Promise<string> => {
    if (encounterId) return encounterId;
    const resolved = await ensureEncounterId?.();
    if (!resolved) throw new Error(MISSING_ENCOUNTER_MESSAGE);
    return resolved;
  }, [encounterId, ensureEncounterId]);

  // Every capture is the same transaction — resolve the encounter, post the
  // record, list what came back as a DRAFT — so the four kinds share one path.
  const captureRecord = useCallback(
    async <TPayload, TRecord>(
      capture: (patientId: string, encounter: string, payload: TPayload) => Promise<TRecord>,
      payload: TPayload,
      toRow: (record: TRecord, status: PassportRecordStatus) => PassportRecordRow
    ) => {
      const resolvedEncounterId = await resolveEncounterId();
      const record = await capture(companionId, resolvedEncounterId, payload);
      setCapturedRows((previous) => [toRow(record, 'DRAFT'), ...previous]);
    },
    [companionId, resolveEncounterId]
  );

  const handleVaccination = useCallback(
    (payload: RecordVaccinationRequestDTO) =>
      captureRecord(recordImmunization, payload, toVaccinationRow),
    [captureRecord]
  );

  const handleTitration = useCallback(
    (payload: RecordRabiesTitrationRequestDTO) =>
      captureRecord(recordRabiesTitration, payload, toRabiesTitrationRow),
    [captureRecord]
  );

  const handleTreatment = useCallback(
    (payload: RecordParasiteTreatmentRequestDTO) =>
      captureRecord(recordParasiteTreatment, payload, toParasiteTreatmentRow),
    [captureRecord]
  );

  const handleExam = useCallback(
    (payload: RecordClinicalExamRequestDTO) =>
      captureRecord(recordClinicalExam, payload, toClinicalExamRow),
    [captureRecord]
  );

  const handleIssue = useCallback(
    async (payload: IssuePassportRequestDTO) => {
      setIssuance(await issuePassport(companionId, payload));
    },
    [companionId]
  );

  const rows = useMemo(() => [...capturedRows, ...signedRows], [capturedRows, signedRows]);

  return (
    <div className="flex flex-col gap-5">
      <PassportIssuanceSection
        companionName={companionName}
        issuance={issuance}
        onIssue={handleIssue}
      />

      {readOnly && <LockedCaptureNotice />}

      {!readOnly && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[12.5px] font-semibold text-(--ink-soft)">
              {'Record to capture'}
            </span>
            <SegmentedPill
              ariaLabel="Record to capture"
              options={RECORD_KIND_OPTIONS}
              value={activeKind}
              onChange={setActiveKind}
              size="md"
            />
          </div>
          {activeKind === 'VACCINATION' && <VaccinationCaptureForm onSubmit={handleVaccination} />}
          {activeKind === 'TITRATION' && <RabiesTitrationCaptureForm onSubmit={handleTitration} />}
          {activeKind === 'TREATMENT' && (
            <ParasiteTreatmentCaptureForm onSubmit={handleTreatment} />
          )}
          {activeKind === 'EXAM' && <ClinicalExamCaptureForm onSubmit={handleExam} />}
        </div>
      )}

      <CapturedRecordsList rows={rows} isLoading={isLoading} loadError={loadError} />
    </div>
  );
};

export default PassportStep;
