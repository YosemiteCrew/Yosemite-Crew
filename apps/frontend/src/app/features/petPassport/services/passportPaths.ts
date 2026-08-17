import { useOrgStore } from '@/app/stores/orgStore';

// Every PMS (staff) pet-passport route is scoped to an organisation, so the
// active org is resolved once here rather than threaded through each caller.
export const requireOrgId = (): string => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) {
    throw new Error('No active organisation selected.');
  }
  return orgId;
};

// `/v1/pet-passport/pms/organisation/:organisationId/companion/:patientId`, the
// prefix shared by the capture, attestation, issuance and read routes.
export const companionPath = (companionId: string): string =>
  `/v1/pet-passport/pms/organisation/${requireOrgId()}/companion/${companionId}`;
