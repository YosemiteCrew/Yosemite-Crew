import { useEffect, useMemo, useState } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  DashboardRange,
  fetchDashboardAppointmentLeaders,
  fetchDashboardAppointmentTrend,
  fetchDashboardInventoryProducts,
  fetchDashboardInventoryTurnover,
  fetchDashboardRevenueLeaders,
  fetchDashboardRevenueTrend,
  fetchDashboardSummary,
} from '@/app/features/dashboard/services/dashboardService';
import { logger } from '@/app/lib/logger';

export const DASHBOARD_DURATION_OPTIONS = [
  'Last week',
  'Last month',
  'Last 6 months',
  'Last 1 year',
] as const;

export type DashboardDurationOption = (typeof DASHBOARD_DURATION_OPTIONS)[number];
export type DashboardDuration = DashboardRange;

type AppointmentChartPoint = {
  month: string;
  Completed: number;
  Cancelled: number;
};

type RevenueChartPoint = {
  month: string;
  Revenue: number;
};

type LeaderPoint = {
  month: string;
  Completed: number;
  Cancelled: number;
};

type RevenueLeader = {
  label: string;
  revenue: number;
};

type InventoryTurnoverPoint = {
  month: string;
  year: number;
  turnover: number;
};

type DashboardAnalyticsData = {
  explore: {
    revenue: number;
    appointments: number;
    tasks: number;
    staffOnDuty: number;
  };
  charts: {
    appointments: AppointmentChartPoint[];
    revenue: RevenueChartPoint[];
  };
  appointmentLeaders: LeaderPoint[];
  revenueLeaders: RevenueLeader[];
  inventoryTurnover: {
    turnsPerYear: number;
    restockCycleDays: number;
    targetTurnsPerYear: number;
    trend: InventoryTurnoverPoint[];
  };
  productTurnover: Array<{
    itemId: string;
    name: string;
    turnover: number;
  }>;
  durationOptions: {
    explore: readonly DashboardDurationOption[];
    appointments: readonly DashboardDurationOption[];
    revenue: readonly DashboardDurationOption[];
    appointmentLeaders: readonly DashboardDurationOption[];
    revenueLeaders: readonly DashboardDurationOption[];
    annualInventoryTurnover: readonly DashboardDurationOption[];
    individualProductTurnover: readonly DashboardDurationOption[];
  };
  emptyState: {
    explore: boolean;
    appointmentsChart: boolean;
    revenueChart: boolean;
    appointmentLeaders: boolean;
    revenueLeaders: boolean;
    annualInventoryTurnover: boolean;
    individualProductTurnover: boolean;
  };
  totals: {
    paidRevenue: number;
    cancelledRevenue: number;
  };
};

const DEFAULT_DATA: DashboardAnalyticsData = {
  explore: {
    revenue: 0,
    appointments: 0,
    tasks: 0,
    staffOnDuty: 0,
  },
  charts: {
    appointments: [],
    revenue: [],
  },
  appointmentLeaders: [],
  revenueLeaders: [],
  inventoryTurnover: {
    turnsPerYear: 0,
    restockCycleDays: 0,
    targetTurnsPerYear: 0,
    trend: [],
  },
  productTurnover: [],
  durationOptions: {
    explore: DASHBOARD_DURATION_OPTIONS,
    appointments: DASHBOARD_DURATION_OPTIONS,
    revenue: DASHBOARD_DURATION_OPTIONS,
    appointmentLeaders: DASHBOARD_DURATION_OPTIONS,
    revenueLeaders: DASHBOARD_DURATION_OPTIONS,
    annualInventoryTurnover: ['Last 1 year'],
    individualProductTurnover: ['Last 1 year'],
  },
  emptyState: {
    explore: true,
    appointmentsChart: true,
    revenueChart: true,
    appointmentLeaders: true,
    revenueLeaders: true,
    annualInventoryTurnover: true,
    individualProductTurnover: true,
  },
  totals: {
    paidRevenue: 0,
    cancelledRevenue: 0,
  },
};

const CACHE_TTL_MS = 90 * 1000;
const analyticsCache = new Map<string, { data: DashboardAnalyticsData; fetchedAt: number }>();
const inflightRequests = new Map<string, Promise<DashboardAnalyticsData>>();

const getMonthsForDuration = (duration: DashboardDuration): number => {
  switch (duration) {
    case 'last_1_year':
      return 12;
    case 'last_6_months':
      return 6;
    case 'last_month':
      return 1;
    case 'last_week':
    default:
      return 1;
  }
};

const clampNumber = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value;
};

const fetchDashboardAnalyticsData = async (
  organisationId: string,
  duration: DashboardDuration
): Promise<DashboardAnalyticsData> => {
  const months = getMonthsForDuration(duration);
  const currentYear = new Date().getFullYear();

  const [
    summaryRes,
    appointmentTrendRes,
    revenueTrendRes,
    appointmentLeadersRes,
    revenueLeadersRes,
    inventoryTurnoverRes,
    inventoryProductsRes,
  ] = await Promise.allSettled([
    fetchDashboardSummary(organisationId, duration),
    fetchDashboardAppointmentTrend(organisationId, months),
    fetchDashboardRevenueTrend(organisationId, months),
    fetchDashboardAppointmentLeaders(organisationId, duration, 5),
    fetchDashboardRevenueLeaders(organisationId, duration, 5),
    fetchDashboardInventoryTurnover(organisationId, currentYear, 8),
    fetchDashboardInventoryProducts(organisationId, currentYear, 10),
  ]);

  const hadAnyFailure = [
    summaryRes,
    appointmentTrendRes,
    revenueTrendRes,
    appointmentLeadersRes,
    revenueLeadersRes,
    inventoryTurnoverRes,
    inventoryProductsRes,
  ].some((result) => result.status === 'rejected');

  if (hadAnyFailure) {
    logger.warn(
      'One or more dashboard analytics requests failed. Rendering partial analytics data.'
    );
  }

  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
  const appointmentTrend =
    appointmentTrendRes.status === 'fulfilled' ? appointmentTrendRes.value : [];
  const revenueTrend = revenueTrendRes.status === 'fulfilled' ? revenueTrendRes.value : [];
  const appointmentLeaders =
    appointmentLeadersRes.status === 'fulfilled' ? appointmentLeadersRes.value : [];
  const revenueLeaders = revenueLeadersRes.status === 'fulfilled' ? revenueLeadersRes.value : [];
  const inventoryTurnover =
    inventoryTurnoverRes.status === 'fulfilled' ? inventoryTurnoverRes.value : null;
  const inventoryProducts =
    inventoryProductsRes.status === 'fulfilled' ? inventoryProductsRes.value : [];

  const appointmentsChart: AppointmentChartPoint[] = appointmentTrend.map((item) => ({
    month: item.label,
    Completed: clampNumber(item.completed),
    Cancelled: clampNumber(item.cancelled),
  }));

  const revenueChart: RevenueChartPoint[] = revenueTrend.map((item) => ({
    month: item.label,
    Revenue: clampNumber(item.revenue),
  }));

  const appointmentLeaderChart: LeaderPoint[] = appointmentLeaders.map((item) => ({
    month: item.name,
    Completed: clampNumber(item.completedAppointments),
    Cancelled: 0,
  }));

  const topRevenueLeaders: RevenueLeader[] = revenueLeaders.map((item) => ({
    label: item.label,
    revenue: clampNumber(item.revenue),
  }));

  const inventoryTrend = (inventoryTurnover?.trend ?? []).map((item) => ({
    month: item.month,
    year: item.year,
    turnover: clampNumber(item.turnover),
  }));

  const merged: DashboardAnalyticsData = {
    ...DEFAULT_DATA,
    explore: {
      revenue: clampNumber(summary?.revenue),
      appointments: clampNumber(summary?.appointments),
      tasks: clampNumber(summary?.tasks),
      staffOnDuty: clampNumber(summary?.staffOnDuty),
    },
    charts: {
      appointments: appointmentsChart,
      revenue: revenueChart,
    },
    appointmentLeaders: appointmentLeaderChart,
    revenueLeaders: topRevenueLeaders,
    inventoryTurnover: {
      turnsPerYear: clampNumber(inventoryTurnover?.turnsPerYear),
      restockCycleDays: clampNumber(inventoryTurnover?.restockCycleDays),
      targetTurnsPerYear: clampNumber(inventoryTurnover?.targetTurnsPerYear),
      trend: inventoryTrend,
    },
    productTurnover: inventoryProducts.map((product) => ({
      itemId: product.itemId,
      name: product.name,
      turnover: clampNumber(product.turnover),
    })),
    emptyState: {
      explore:
        clampNumber(summary?.revenue) === 0 &&
        clampNumber(summary?.appointments) === 0 &&
        clampNumber(summary?.tasks) === 0 &&
        clampNumber(summary?.staffOnDuty) === 0,
      appointmentsChart: appointmentsChart.length === 0,
      revenueChart: revenueChart.length === 0,
      appointmentLeaders:
        appointmentLeaderChart.length === 0 ||
        appointmentLeaderChart.every((leader) => leader.Completed === 0 && leader.Cancelled === 0),
      revenueLeaders: topRevenueLeaders.length === 0,
      annualInventoryTurnover: !inventoryTurnover || inventoryTrend.length === 0,
      individualProductTurnover: inventoryProducts.length === 0,
    },
    totals: {
      paidRevenue: clampNumber(summary?.revenue),
      cancelledRevenue: 0,
    },
  };

  return merged;
};

const loadAnalyticsData = async (
  organisationId: string,
  duration: DashboardDuration,
  cacheKey: string
): Promise<DashboardAnalyticsData> => {
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt <= CACHE_TTL_MS) {
    return cached.data;
  }

  const existingRequest = inflightRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetchDashboardAnalyticsData(organisationId, duration)
    .then((data) => {
      analyticsCache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
};

export const mapDashboardDurationOption = (option: string): DashboardDuration => {
  switch (option) {
    case 'Last month':
      return 'last_month';
    case 'Last 6 months':
      return 'last_6_months';
    case 'Last 1 year':
      return 'last_1_year';
    case 'Last week':
    default:
      return 'last_week';
  }
};

export const useDashboardAnalytics = (duration: DashboardDuration) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [data, setData] = useState<DashboardAnalyticsData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!primaryOrgId) {
      setData(DEFAULT_DATA);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = `${primaryOrgId}:${duration}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached) {
      setData(cached.data);
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const next = await loadAnalyticsData(primaryOrgId, duration, cacheKey);
        if (!cancelled) {
          setData(next);
        }
      } catch (err) {
        logger.error('Failed to load dashboard analytics:', err);
        if (!cancelled) {
          setError('Unable to load dashboard analytics right now.');
          setData(DEFAULT_DATA);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [primaryOrgId, duration]);

  return useMemo(
    () => ({
      ...data,
      isLoading,
      error,
    }),
    [data, isLoading, error]
  );
};
