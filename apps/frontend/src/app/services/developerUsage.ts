import { getData } from '@/app/services/axios';

export interface DeveloperUsage {
  /** UTC year-month key the backend bills on, e.g. "2026-08". */
  billingPeriod: string;
  callCount: number;
  /** Calls included before metering starts; null on plans with no cap. */
  limit: number | null;
}

const BASE = '/v1/developers/usage';

export const getUsage = async (period?: string): Promise<DeveloperUsage> => {
  const res = await getData<{ data: DeveloperUsage }>(
    period ? `${BASE}?period=${encodeURIComponent(period)}` : BASE
  );
  return res.data.data;
};
