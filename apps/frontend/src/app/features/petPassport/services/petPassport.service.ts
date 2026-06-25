import api, { getData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type { PetPassportDTO } from '@yosemite-crew/types';

const requireOrgId = (): string => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) {
    throw new Error('No active organisation selected.');
  }
  return orgId;
};

// Fetch the assembled, multi-section pet passport for a companion. The backend
// builds it from the source-of-truth Patient + Vaccination records.
export const getPetPassport = async (companionId: string): Promise<PetPassportDTO> => {
  const res = await getData(
    `/v1/pet-passport/pms/organisation/${requireOrgId()}/companion/${companionId}/passport`
  );
  return res.data as PetPassportDTO;
};

// Fetch the signed .pkpass over the authenticated channel and trigger a
// download. On Apple devices the .pkpass opens straight into Wallet; elsewhere
// it saves the file. Auth headers are required, so this goes through the api
// instance rather than a bare link.
export const downloadApplePass = async (companionId: string, petName: string): Promise<void> => {
  const res = await api.get<Blob>(
    `/v1/pet-passport/pms/organisation/${requireOrgId()}/companion/${companionId}/wallet/apple`,
    { responseType: 'blob' }
  );
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${petName}.pkpass`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// Fetch the "Add to Google Wallet" save URL (a signed JWT the backend mints).
// The caller opens it; Android offers to save the pass to Google Wallet.
export const getGoogleWalletUrl = async (companionId: string): Promise<string> => {
  const res = await getData<{ saveUrl: string }>(
    `/v1/pet-passport/pms/organisation/${requireOrgId()}/companion/${companionId}/wallet/google`
  );
  return res.data.saveUrl;
};
