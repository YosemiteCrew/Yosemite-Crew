import { getData, postData, deleteData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type {
  CompanionCardDTO,
  IssueShareTokenRequestDTO,
  IssueShareTokenResultDTO,
  ShareTokenResponseDTO,
} from '@yosemite-crew/types';

const requireOrgId = (): string => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) throw new Error('No active organisation selected.');
  return orgId;
};

const companionBase = (patientId: string): string =>
  `/v1/companion-card/pms/organisation/${requireOrgId()}/companion/${patientId}`;

// Authenticated staff render of the full card.
export const getCompanionCard = async (patientId: string): Promise<CompanionCardDTO> => {
  const res = await getData<CompanionCardDTO>(`${companionBase(patientId)}/card`);
  return res.data;
};

export const issueShareToken = async (
  patientId: string,
  body: IssueShareTokenRequestDTO
): Promise<IssueShareTokenResultDTO> => {
  const res = await postData<IssueShareTokenResultDTO, IssueShareTokenRequestDTO>(
    `${companionBase(patientId)}/share`,
    body
  );
  return res.data;
};

export const listShareTokens = async (patientId: string): Promise<ShareTokenResponseDTO[]> => {
  const res = await getData<{ tokens: ShareTokenResponseDTO[] }>(
    `${companionBase(patientId)}/shares`
  );
  return res.data.tokens;
};

export const revokeShareToken = async (tokenId: string): Promise<ShareTokenResponseDTO> => {
  const res = await deleteData<ShareTokenResponseDTO>(
    `/v1/companion-card/pms/organisation/${requireOrgId()}/share/${tokenId}`
  );
  return res.data;
};

// Public, unauthenticated resolve. Uses a raw fetch so the authed axios
// interceptor does not redirect an unauthenticated visitor to sign in.
export const getPublicCompanionCard = async (token: string): Promise<CompanionCardDTO> => {
  const root = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${root}/public/companion-card/${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Card not found.');
  }
  return (await res.json()) as CompanionCardDTO;
};
