import { renderHook, waitFor } from '@testing-library/react';
import {
  mapDashboardDurationOption,
  useDashboardAnalytics,
} from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import {
  fetchDashboardAppointmentLeaders,
  fetchDashboardAppointmentTrend,
  fetchDashboardInventoryProducts,
  fetchDashboardInventoryTurnover,
  fetchDashboardRevenueLeaders,
  fetchDashboardRevenueTrend,
  fetchDashboardSummary,
} from '@/app/features/dashboard/services/dashboardService';
import { useOrgStore } from '@/app/stores/orgStore';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/features/dashboard/services/dashboardService', () => ({
  fetchDashboardSummary: jest.fn(),
  fetchDashboardAppointmentTrend: jest.fn(),
  fetchDashboardRevenueTrend: jest.fn(),
  fetchDashboardAppointmentLeaders: jest.fn(),
  fetchDashboardRevenueLeaders: jest.fn(),
  fetchDashboardInventoryTurnover: jest.fn(),
  fetchDashboardInventoryProducts: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useDashboardAnalytics', () => {
  let currentOrgId: string | undefined;

  const mockUseOrgStore = useOrgStore as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    currentOrgId = 'org-1';

    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: currentOrgId }));

    (fetchDashboardSummary as jest.Mock).mockResolvedValue({
      revenue: 1200,
      appointments: 15,
      tasks: 5,
      staffOnDuty: 3,
    });
    (fetchDashboardAppointmentTrend as jest.Mock).mockResolvedValue([
      { label: 'Mon', completed: 10, cancelled: 1 },
    ]);
    (fetchDashboardRevenueTrend as jest.Mock).mockResolvedValue([{ label: 'Mon', revenue: 800 }]);
    (fetchDashboardAppointmentLeaders as jest.Mock).mockResolvedValue([
      { staffId: 's-1', completedAppointments: 6 },
    ]);
    (fetchDashboardRevenueLeaders as jest.Mock).mockResolvedValue([
      { label: 'Surgery', revenue: 500 },
    ]);
    (fetchDashboardInventoryTurnover as jest.Mock).mockResolvedValue({
      turnsPerYear: 4,
      restockCycleDays: 90,
      targetTurnsPerYear: 8,
      trend: [{ month: 'Jan', year: 2026, turnover: 1.2 }],
    });
    (fetchDashboardInventoryProducts as jest.Mock).mockResolvedValue([
      { itemId: 'i-1', name: 'Food', turnover: 2.5 },
    ]);
  });

  it('maps dashboard duration options correctly', () => {
    expect(mapDashboardDurationOption('Last week')).toBe('last_week');
    expect(mapDashboardDurationOption('Last month')).toBe('last_month');
    expect(mapDashboardDurationOption('Last 6 months')).toBe('last_6_months');
    expect(mapDashboardDurationOption('Last 1 year')).toBe('last_1_year');
    expect(mapDashboardDurationOption('Unknown')).toBe('last_week');
  });

  it('returns defaults and skips requests when org is missing', () => {
    currentOrgId = undefined;

    const { result } = renderHook(() => useDashboardAnalytics('last_week'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.explore.revenue).toBe(0);
    expect(fetchDashboardSummary).not.toHaveBeenCalled();
  });

  it('loads and maps analytics data for last_week (day bucket)', async () => {
    currentOrgId = 'org-day';

    const { result } = renderHook(() => useDashboardAnalytics('last_week'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.explore).toEqual({
      revenue: 1200,
      appointments: 15,
      tasks: 5,
      staffOnDuty: 3,
    });
    expect(result.current.charts.appointments).toEqual([
      { month: 'Mon', Completed: 10, Cancelled: 1 },
    ]);
    expect(result.current.charts.revenue).toEqual([{ month: 'Mon', Revenue: 800 }]);
    expect(fetchDashboardAppointmentTrend).toHaveBeenCalledWith('org-day', 'last_week', 'day');
    expect(fetchDashboardRevenueTrend).toHaveBeenCalledWith('org-day', 'last_week', 'day');
  });

  it('uses month bucket for long durations', async () => {
    currentOrgId = 'org-month';

    const { result } = renderHook(() => useDashboardAnalytics('last_1_year'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchDashboardAppointmentTrend).toHaveBeenCalledWith(
      'org-month',
      'last_1_year',
      'month'
    );
    expect(fetchDashboardRevenueTrend).toHaveBeenCalledWith('org-month', 'last_1_year', 'month');
  });

  it('logs warning and returns partial data when some requests fail', async () => {
    currentOrgId = 'org-partial';
    (fetchDashboardRevenueLeaders as jest.Mock).mockRejectedValueOnce(new Error('downstream'));

    const { result } = renderHook(() => useDashboardAnalytics('last_month'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(logger.warn).toHaveBeenCalled();
    expect(result.current.revenueLeaders).toEqual([]);
    expect(result.current.explore.revenue).toBe(1200);
  });

  it('sets user-friendly error when loading throws unexpectedly', async () => {
    currentOrgId = 'org-error';
    (fetchDashboardSummary as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const { result } = renderHook(() => useDashboardAnalytics('last_6_months'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Unable to load dashboard analytics right now.');
    });

    expect(logger.error).toHaveBeenCalled();
    expect(result.current.explore.revenue).toBe(0);
  });
});
