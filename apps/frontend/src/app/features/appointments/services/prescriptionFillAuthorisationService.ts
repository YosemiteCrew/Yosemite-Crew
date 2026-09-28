import { getData, postData } from '@/app/services/axios';

export type FillEligibility = {
  authorizationId: string | null;
  version: number | null;
  eligible: boolean;
  reasonCodes: string[];
  remainingFills: number;
  remainingQuantity: string | null;
  unit: string | null;
  expiresAt: string | null;
};

export type FillAuthorisationInput = {
  validUntil: string;
  maxAdditionalFills: number;
  perFillQuantity: string;
  perFillQuantityUnit: string;
};

export type FillAuthorisation = {
  id: string;
  version: number;
  validUntil: string;
  maxAdditionalFills: number;
};

const itemPath = (organisationId: string, itemId: string) =>
  `/v1/prescriptions/organisations/${encodeURIComponent(organisationId)}/items/${encodeURIComponent(itemId)}`;

export const getFillEligibility = async (organisationId: string, itemId: string) => {
  const response = await getData<FillEligibility>(
    `${itemPath(organisationId, itemId)}/fill-eligibility`
  );
  return response.data;
};

export const authoriseFills = async (
  organisationId: string,
  itemId: string,
  input: FillAuthorisationInput
) => {
  const response = await postData<FillAuthorisation, FillAuthorisationInput>(
    `${itemPath(organisationId, itemId)}/fill-authorisations`,
    input
  );
  return response.data;
};
