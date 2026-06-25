import { getData } from '@/app/services/axios';
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
