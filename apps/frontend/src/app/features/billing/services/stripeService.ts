import { useCounterStore } from '@/app/stores/counterStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { BillingCounter, BillingSubscription } from '@/app/features/billing/types/billing';
import { getData, postData } from '@/app/services/axios';

export type CheckStatusResponse = {
  orgBilling: BillingSubscription;
  orgUsage: BillingCounter;
};

type FinanceEnvelope<T> = {
  data?: T;
  meta?: unknown;
  error?: { message?: string; code?: string } | null;
};

type FinanceProviderLink = {
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalSubscriptionItemId?: string | null;
  externalPriceId?: string | null;
  externalProductId?: string | null;
  updatedAt?: string | Date | null;
};

type FinanceEntitlement = {
  code?: string | null;
  status?: string | null;
  value?: unknown;
  grantedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type FinanceUsageCounter = Partial<BillingCounter> & {
  orgId?: string;
  updatedAt?: string | Date | null;
};

type FinanceUsageSnapshot = {
  appointmentsUsed?: number | null;
  toolsUsed?: number | null;
  seatsActive?: number | null;
  seatsBillable?: number | null;
  snapshotAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type FinanceCurrentSubscription = {
  organisationId?: string;
  providerLink?: FinanceProviderLink | null;
  providerLinks?: FinanceProviderLink[];
  entitlement?: FinanceEntitlement | null;
  entitlements?: FinanceEntitlement[];
  usageCounter?: FinanceUsageCounter | null;
  latestSnapshot?: FinanceUsageSnapshot | null;
};

const isFinanceEnvelope = <T>(value: T | FinanceEnvelope<T>): value is FinanceEnvelope<T> =>
  Boolean(
    value && typeof value === 'object' && 'data' in value && ('meta' in value || 'error' in value)
  );

const FREE_APPOINTMENTS_LIMIT = 120;
const FREE_TOOLS_LIMIT = 200;
const FREE_USERS_LIMIT = 10;

const unwrapFinanceData = <T>(value: T | FinanceEnvelope<T>): T | undefined => {
  if (isFinanceEnvelope(value)) {
    if (value.error) {
      throw new Error(value.error.message || value.error.code || 'Finance request failed');
    }
    return value.data;
  }
  return value;
};

const parseDate = (value?: string | Date | null): Date | null | undefined => {
  if (!value) return value === null ? null : undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const normalizePlan = (entitlement?: FinanceEntitlement | null): BillingSubscription['plan'] => {
  const code = entitlement?.code?.toLowerCase() ?? '';
  if (code.includes('business') || code.includes('pro')) return 'business';
  return 'free';
};

const normalizeSubscription = (
  orgId: string,
  current: FinanceCurrentSubscription
): BillingSubscription => {
  const providerLink = current.providerLink ?? current.providerLinks?.[0] ?? null;
  const entitlement =
    current.entitlement ??
    current.entitlements?.find((entry) => entry.status === 'ACTIVE') ??
    current.entitlements?.[0] ??
    null;
  const plan = normalizePlan(entitlement);
  return {
    orgId,
    plan,
    accessState: plan === 'business' ? 'active' : 'free',
    subscriptionStatus: plan === 'business' ? 'active' : 'none',
    stripeCustomerId: providerLink?.externalCustomerId ?? null,
    stripeSubscriptionId: providerLink?.externalSubscriptionId ?? null,
    stripeSubscriptionItemId: providerLink?.externalSubscriptionItemId ?? null,
    stripePriceId: providerLink?.externalPriceId ?? null,
    stripeProductId: providerLink?.externalProductId ?? null,
    canAcceptPayments: Boolean(
      providerLink?.externalCustomerId || providerLink?.externalSubscriptionId
    ),
    joinedAt:
      parseDate(entitlement?.grantedAt) ??
      parseDate(providerLink?.updatedAt) ??
      parseDate(entitlement?.updatedAt) ??
      undefined,
    nextInvoiceAt: parseDate(entitlement?.expiresAt),
  };
};

const normalizeCounter = (
  orgId: string,
  current: FinanceCurrentSubscription,
  snapshots: FinanceUsageSnapshot[] = []
): BillingCounter => {
  const usage = current.usageCounter;
  const snapshot = current.latestSnapshot ?? snapshots[0] ?? null;
  return {
    orgId,
    appointmentsUsed: usage?.appointmentsUsed ?? snapshot?.appointmentsUsed ?? 0,
    toolsUsed: usage?.toolsUsed ?? snapshot?.toolsUsed ?? 0,
    usersActiveCount: usage?.usersActiveCount ?? snapshot?.seatsActive ?? 0,
    usersBillableCount: usage?.usersBillableCount ?? snapshot?.seatsBillable ?? 0,
    freeAppointmentsLimit: usage?.freeAppointmentsLimit ?? FREE_APPOINTMENTS_LIMIT,
    freeToolsLimit: usage?.freeToolsLimit ?? FREE_TOOLS_LIMIT,
    freeUsersLimit: usage?.freeUsersLimit ?? FREE_USERS_LIMIT,
    freeLimitReachedAt: parseDate(usage?.freeLimitReachedAt) ?? null,
  };
};

export const checkStatus = async (orgId: string | null) => {
  const { setSubscriptionForOrg } = useSubscriptionStore.getState();
  const { setCounterForOrg } = useCounterStore.getState();
  if (!orgId) {
    throw new Error('OrgId does not exist');
  }
  try {
    const currentRes = await getData<FinanceEnvelope<FinanceCurrentSubscription>>(
      `/v1/finance/subscriptions/current?organisationId=${encodeURIComponent(orgId)}`
    );
    const current = unwrapFinanceData(currentRes.data) ?? { organisationId: orgId };
    let snapshots: FinanceUsageSnapshot[] = [];
    try {
      const snapshotsRes = await getData<FinanceEnvelope<FinanceUsageSnapshot[]>>(
        `/v1/finance/usage-snapshots?organisationId=${encodeURIComponent(orgId)}&featureKey=appointments`
      );
      snapshots = unwrapFinanceData(snapshotsRes.data) ?? [];
    } catch (snapshotError) {
      console.warn('Failed to load finance usage snapshots:', snapshotError);
    }
    const orgBilling = normalizeSubscription(orgId, current);
    const orgUsage = normalizeCounter(orgId, current, snapshots);
    setSubscriptionForOrg(orgId, orgBilling);
    setCounterForOrg(orgId, orgUsage);
    return { orgBilling, orgUsage };
  } catch (err: any) {
    console.error('Failed to load billing status:', err);
    throw err;
  }
};

export const createConnectedAccount = async (orgId: string | null) => {
  if (!orgId) {
    throw new Error('OrgId does not exist');
  }
  try {
    const res = await postData<{ accountId: string }>(
      '/v1/stripe/organisation/' + orgId + '/account'
    );
    return res.data.accountId;
  } catch (err: any) {
    console.error('Failed to load orgs:', err);
    throw err;
  }
};

export const onBoardConnectedAccount = async (orgId: string | null) => {
  if (!orgId) {
    throw new Error('OrgId does not exist');
  }
  try {
    const res = await postData<{ client_secret: string }>(
      '/v1/stripe/organisation/' + orgId + '/onboarding'
    );
    return res.data.client_secret;
  } catch (err: any) {
    console.error('Failed to load orgs:', err);
    throw err;
  }
};
