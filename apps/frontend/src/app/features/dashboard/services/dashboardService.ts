import { getData } from '@/app/services/axios';

export type DashboardRange = 'last_week' | 'last_month' | 'last_6_months' | 'last_1_year';
export type DashboardBucket = 'day' | 'month';

export type DashboardSummaryResponse = {
  revenue: number;
  appointments: number;
  tasks: number;
  staffOnDuty: number;
};

export type DashboardAppointmentTrendItem = {
  label: string;
  year: number;
  month: number;
  day?: number | null;
  completed: number;
  cancelled: number;
};

export type DashboardRevenueTrendItem = {
  label: string;
  year: number;
  month: number;
  day?: number | null;
  revenue: number;
  paidRevenue?: number | null;
  cancelledRevenue?: number | null;
};

export type DashboardAppointmentLeaderItem = {
  staffId: string;
  name: string;
  completedAppointments: number;
};

export type DashboardRevenueLeaderItem = {
  serviceKey: string;
  label: string;
  revenue: number;
};

export type DashboardInventoryTurnoverTrendItem = {
  month: string;
  year: number;
  turnover: number;
};

export type DashboardInventoryTurnoverResponse = {
  turnsPerYear: number;
  restockCycleDays: number;
  targetTurnsPerYear: number;
  trend: DashboardInventoryTurnoverTrendItem[];
};

export type DashboardInventoryProductTurnoverItem = {
  itemId: string;
  name: string;
  turnover: number;
};

const stripEmpty = (params: Record<string, string | number | undefined>) =>
  Object.entries(params).reduce<Record<string, string | number>>((acc, [key, value]) => {
    if (value === undefined || value === '') return acc;
    acc[key] = value;
    return acc;
  }, {});

export const fetchDashboardSummary = async (organisationId: string, range: DashboardRange) => {
  const res = await getData<DashboardSummaryResponse>(
    `/v1/dashboard/summary/${organisationId}`,
    stripEmpty({ range })
  );
  return res.data;
};

export const fetchDashboardAppointmentTrend = async (
  organisationId: string,
  range: DashboardRange,
  bucket: DashboardBucket
) => {
  const res = await getData<DashboardAppointmentTrendItem[]>(
    `/v1/dashboard/appointments/${organisationId}/trend`,
    stripEmpty({ range, bucket })
  );
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchDashboardRevenueTrend = async (
  organisationId: string,
  range: DashboardRange,
  bucket: DashboardBucket
) => {
  const res = await getData<DashboardRevenueTrendItem[]>(
    `/v1/dashboard/revenue/${organisationId}/trend`,
    stripEmpty({ range, bucket })
  );
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchDashboardAppointmentLeaders = async (
  organisationId: string,
  range: DashboardRange,
  limit: number
) => {
  const res = await getData<DashboardAppointmentLeaderItem[]>(
    `/v1/dashboard/appointment-leaders/${organisationId}`,
    stripEmpty({ range, limit })
  );
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchDashboardRevenueLeaders = async (
  organisationId: string,
  range: DashboardRange,
  limit: number
) => {
  const res = await getData<DashboardRevenueLeaderItem[]>(
    `/v1/dashboard/revenue-leaders/${organisationId}`,
    stripEmpty({ range, limit })
  );
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchDashboardInventoryTurnover = async (
  organisationId: string,
  year: number,
  targetTurns: number
) => {
  const res = await getData<DashboardInventoryTurnoverResponse>(
    `/v1/dashboard/inventory/${organisationId}/turnover`,
    stripEmpty({ year, targetTurns })
  );
  return res.data;
};

export const fetchDashboardInventoryProducts = async (
  organisationId: string,
  year: number,
  limit: number
) => {
  const res = await getData<DashboardInventoryProductTurnoverItem[]>(
    `/v1/dashboard/inventory/${organisationId}/products`,
    stripEmpty({ year, limit })
  );
  return Array.isArray(res.data) ? res.data : [];
};
