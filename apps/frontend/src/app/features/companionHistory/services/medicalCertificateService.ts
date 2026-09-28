import { getData, postData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';

export type MedicalCertificateType =
  | 'HEALTH_CERTIFICATE'
  | 'VACCINATION_CERTIFICATE'
  | 'FIT_FOR_TRAVEL'
  | 'EXPORT_CERTIFICATE'
  | 'BOARDING_CLEARANCE'
  | 'BREEDING_CLEARANCE'
  | 'OTHER';

export type MedicalCertificateStatus = 'DRAFT' | 'ISSUED' | 'EXPIRED' | 'REVOKED';

export type MedicalCertificate = {
  id: string;
  organisationId: string;
  patientId: string;
  clientId: string;
  certificateType: MedicalCertificateType;
  status: MedicalCertificateStatus;
  issueNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  issuedBy: string | null;
  validForTravel: boolean;
  destinationCountry: string | null;
  clinicalFindings: string | null;
  restrictions: string | null;
  notes: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMedicalCertificateInput = {
  patientId: string;
  clientId: string;
  certificateType: MedicalCertificateType;
  validForTravel?: boolean;
  destinationCountry?: string;
  clinicalFindings?: string;
  restrictions?: string;
  notes?: string;
};

const collectionPath = (): string => {
  const organisationId = useOrgStore.getState().primaryOrgId;
  if (!organisationId) throw new Error('No active organisation selected.');
  return `/v1/pms/organisation/${encodeURIComponent(organisationId)}/medical-certificates`;
};

export const fetchMedicalCertificates = async (
  patientId: string
): Promise<MedicalCertificate[]> => {
  if (!patientId) throw new Error('Patient ID missing.');
  const response = await getData<MedicalCertificate[]>(collectionPath(), { patientId });
  return response.data;
};

export const createMedicalCertificate = async (
  input: CreateMedicalCertificateInput
): Promise<MedicalCertificate> => {
  const response = await postData<MedicalCertificate, CreateMedicalCertificateInput>(
    collectionPath(),
    input
  );
  return response.data;
};

export const issueMedicalCertificate = async (
  certificateId: string,
  input: {
    expiresAt?: string;
    clinicalFindings?: string;
    restrictions?: string;
    notes?: string;
  }
): Promise<MedicalCertificate> => {
  const response = await postData<MedicalCertificate, typeof input>(
    `${collectionPath()}/${encodeURIComponent(certificateId)}/issue`,
    input
  );
  return response.data;
};

export const revokeMedicalCertificate = async (
  certificateId: string,
  input: { revokedReason?: string }
): Promise<MedicalCertificate> => {
  const response = await postData<MedicalCertificate, typeof input>(
    `${collectionPath()}/${encodeURIComponent(certificateId)}/revoke`,
    input
  );
  return response.data;
};
