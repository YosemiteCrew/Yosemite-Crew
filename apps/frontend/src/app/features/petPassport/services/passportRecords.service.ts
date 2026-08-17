import { postData } from '@/app/services/axios';
import { companionPath } from '@/app/features/petPassport/services/passportPaths';
import type {
  ClinicalExamDTO,
  IssuePassportRequestDTO,
  ParasiteTreatmentDTO,
  PetPassportIssuanceDTO,
  RabiesTitrationDTO,
  RecordClinicalExamRequestDTO,
  RecordParasiteTreatmentRequestDTO,
  RecordRabiesTitrationRequestDTO,
  RecordVaccinationRequestDTO,
  VaccinationDTO,
} from '@yosemite-crew/types';

/**
 * Signatory details a vet may attach when requesting a signature or attesting.
 * Both fields are optional: the backend accepts an absent body as an empty one.
 */
export type AttestationInput = {
  signatoryName?: string;
  signatoryLicence?: string;
};

export type RevokeRecordInput = {
  reason?: string;
};

/** 202 from `/records/:recordId/sign` - the e-signature is now pending. */
export type RecordSignatureRequested = {
  artifactId: string;
  status: 'IN_PROGRESS';
  documensoDocumentId: string;
};

/** 200 from `/records/:recordId/attest` - the record is now passport-visible. */
export type RecordAttested = {
  artifactId: string;
  status: 'SIGNED';
  signedAt: string;
};

/** 200 from `/records/:recordId/revoke` - the record drops out of the passport. */
export type RecordRevoked = {
  artifactId: string;
  status: 'VOID';
};

// Clinical dates land on a travel health document, so the backend accepts only
// an unambiguous ISO-8601 calendar date ("2026-02-14") or a full ISO-8601
// datetime with a timezone. The round-trip check rejects impossible days, which
// JavaScript's Date would otherwise roll over silently ("2026-02-30" -> 2 March).
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Mirrors the backend's clinical-date rule so a form can reject a bad date
 * before it becomes a 400 "Invalid request body".
 */
export const isValidClinicalDate = (value: string): boolean => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  if (ISO_DATE_ONLY_PATTERN.test(value)) {
    return parsed.toISOString().startsWith(value);
  }
  return ISO_DATE_TIME_PATTERN.test(value);
};

// The org lookup happens inside this async helper on purpose: callers await
// these functions, so a missing organisation must surface as a rejected promise
// rather than a synchronous throw out of a submit handler.
const post = async <TResponse>(
  companionId: string,
  suffix: string,
  body: unknown
): Promise<TResponse> => {
  const res = await postData<TResponse>(`${companionPath(companionId)}${suffix}`, body);
  return res.data;
};

const recordAction = (recordId: string, action: string): string => `/records/${recordId}/${action}`;

// -- Capture (passport:edit:any / vaccinations:edit:any; held by every staff role) --
// Each record is created as a DRAFT ClinicalArtifact hung off the appointment's
// encounter, so `encounterId` is required and travels in the body.

export const recordImmunization = (
  companionId: string,
  encounterId: string,
  input: RecordVaccinationRequestDTO
): Promise<VaccinationDTO> =>
  post<VaccinationDTO>(companionId, '/immunizations', { encounterId, ...input });

export const recordParasiteTreatment = (
  companionId: string,
  encounterId: string,
  input: RecordParasiteTreatmentRequestDTO
): Promise<ParasiteTreatmentDTO> =>
  post<ParasiteTreatmentDTO>(companionId, '/treatments', { encounterId, ...input });

export const recordRabiesTitration = (
  companionId: string,
  encounterId: string,
  input: RecordRabiesTitrationRequestDTO
): Promise<RabiesTitrationDTO> =>
  post<RabiesTitrationDTO>(companionId, '/titrations', { encounterId, ...input });

export const recordClinicalExam = (
  companionId: string,
  encounterId: string,
  input: RecordClinicalExamRequestDTO
): Promise<ClinicalExamDTO> =>
  post<ClinicalExamDTO>(companionId, '/clinical-exams', { encounterId, ...input });

// -- Attestation (passport:attest:any; VETERINARIAN only) --
// Callers must gate these behind the veterinarian permission: a non-vet reaching
// them gets a 403 from the backend, so the affordance must not be offered.

/** Sends the rendered record for e-signature; the record stays IN_PROGRESS. */
export const requestRecordSignature = (
  companionId: string,
  recordId: string,
  input: AttestationInput = {}
): Promise<RecordSignatureRequested> =>
  post<RecordSignatureRequested>(companionId, recordAction(recordId, 'sign'), input);

/** The authenticated vet attests directly, flipping the record to SIGNED. */
export const attestRecord = (
  companionId: string,
  recordId: string,
  input: AttestationInput = {}
): Promise<RecordAttested> =>
  post<RecordAttested>(companionId, recordAction(recordId, 'attest'), input);

/** Voids an attestation (error, lapsed, fraud); the record leaves the passport. */
export const revokeRecord = (
  companionId: string,
  recordId: string,
  input: RevokeRecordInput = {}
): Promise<RecordRevoked> =>
  post<RecordRevoked>(companionId, recordAction(recordId, 'revoke'), input);

// -- Issuance (passport:edit:any) --

export const issuePassport = (
  companionId: string,
  input: IssuePassportRequestDTO
): Promise<PetPassportIssuanceDTO> => post<PetPassportIssuanceDTO>(companionId, '/issue', input);
