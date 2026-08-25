import { getData, postData } from '@/app/services/axios';

export type DeveloperPlanTier = 'free' | 'pro' | 'enterprise';
export type DeveloperSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export interface DeveloperSubscription {
  id: string | null;
  organisationId: string;
  plan: DeveloperPlanTier;
  status: DeveloperSubscriptionStatus;
  stripeSubscriptionItemId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CheckoutPayload {
  successUrl: string;
  cancelUrl: string;
}

const BASE = '/v1/developers/billing';

export const getSubscription = async (): Promise<DeveloperSubscription> => {
  const res = await getData<{ data: DeveloperSubscription }>(BASE);
  return res.data.data;
};

export const createCheckoutSession = async (payload: CheckoutPayload): Promise<string> => {
  const res = await postData<{ data: { url: string } }, CheckoutPayload>(
    `${BASE}/checkout`,
    payload
  );
  return res.data.data.url;
};

export const createPortalSession = async (returnUrl: string): Promise<string> => {
  const res = await postData<{ data: { url: string } }, { returnUrl: string }>(`${BASE}/portal`, {
    returnUrl,
  });
  return res.data.data.url;
};
