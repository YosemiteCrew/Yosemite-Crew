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

/**
 * What a reader is told about an item's repeats. An expired or withdrawn
 * authority never reports a count, so a fill that cannot be dispensed is not
 * shown as remaining.
 */
export const describeFillEligibility = (eligibility: FillEligibility): string => {
  const reasons = eligibility.reasonCodes;
  if (reasons.includes('AUTHORITY_REVOKED')) return 'Refill authorisation revoked';
  if (reasons.includes('AUTHORITY_SUPERSEDED')) return 'Replaced by a newer refill authorisation';
  if (!eligibility.authorizationId) return 'No active refill authorisation';
  if (reasons.includes('AUTHORITY_EXPIRED')) return 'Refill authorisation expired';
  const noun = eligibility.remainingFills === 1 ? 'fill' : 'fills';
  return `${eligibility.remainingFills} authorised ${noun} remaining`;
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
