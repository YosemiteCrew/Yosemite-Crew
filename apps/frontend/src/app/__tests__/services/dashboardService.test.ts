import {
  fetchDashboardAppointmentLeaders,
  fetchDashboardAppointmentTrend,
  fetchDashboardInventoryProducts,
  fetchDashboardInventoryTurnover,
  fetchDashboardRevenueLeaders,
  fetchDashboardRevenueTrend,
  fetchDashboardSummary,
} from '@/app/features/dashboard/services/dashboardService';
import { getData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
}));

const mockedGetData = getData as jest.Mock;

describe('dashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches summary analytics', async () => {
    mockedGetData.mockResolvedValueOnce({
      data: { revenue: 10, appointments: 2, tasks: 1, staffOnDuty: 3 },
    });

    const result = await fetchDashboardSummary('org-1', 'last_week');

    expect(mockedGetData).toHaveBeenCalledWith('/v1/dashboard/summary/org-1', {
      range: 'last_week',
    });
    expect(result).toEqual({ revenue: 10, appointments: 2, tasks: 1, staffOnDuty: 3 });
  });

  it('fetches appointment and revenue trends', async () => {
    mockedGetData
      .mockResolvedValueOnce({ data: [{ label: 'Jan', completed: 5, cancelled: 1 }] })
      .mockResolvedValueOnce({ data: [{ label: 'Jan', revenue: 500 }] })
      .mockResolvedValueOnce({ data: [{ label: 'Feb', completed: 8, cancelled: 2 }] })
      .mockResolvedValueOnce({ data: [{ label: 'Feb', revenue: 650 }] });

    const appointmentTrend = await fetchDashboardAppointmentTrend('org-1', 'last_week', 'day');
    const revenueTrend = await fetchDashboardRevenueTrend('org-1', 'last_month', 'day');
    await fetchDashboardAppointmentTrend('org-1', 'last_6_months', 'month');
    await fetchDashboardRevenueTrend('org-1', 'last_1_year', 'month');

    expect(mockedGetData).toHaveBeenNthCalledWith(1, '/v1/dashboard/appointments/org-1/trend', {
      range: 'last_week',
      bucket: 'day',
    });
    expect(mockedGetData).toHaveBeenNthCalledWith(2, '/v1/dashboard/revenue/org-1/trend', {
      range: 'last_month',
      bucket: 'day',
    });
    expect(mockedGetData).toHaveBeenNthCalledWith(3, '/v1/dashboard/appointments/org-1/trend', {
      range: 'last_6_months',
      bucket: 'month',
    });
    expect(mockedGetData).toHaveBeenNthCalledWith(4, '/v1/dashboard/revenue/org-1/trend', {
      range: 'last_1_year',
      bucket: 'month',
    });
    expect(appointmentTrend).toEqual([{ label: 'Jan', completed: 5, cancelled: 1 }]);
    expect(revenueTrend).toEqual([{ label: 'Jan', revenue: 500 }]);
  });

  it('fetches leaders and inventory analytics', async () => {
    mockedGetData
      .mockResolvedValueOnce({ data: [{ staffId: 's-1', name: 'Dr A', completedAppointments: 7 }] })
      .mockResolvedValueOnce({ data: [{ serviceKey: 'svc-1', label: 'Exam', revenue: 900 }] })
      .mockResolvedValueOnce({
        data: {
          turnsPerYear: 7.4,
          restockCycleDays: 49,
          targetTurnsPerYear: 8,
          trend: [{ month: 'Jan', year: 2026, turnover: 0.55 }],
        },
      })
      .mockResolvedValueOnce({ data: [{ itemId: 'p-1', name: 'Product', turnover: 4.8 }] });

    const appointmentLeaders = await fetchDashboardAppointmentLeaders('org-1', 'last_week', 5);
    const revenueLeaders = await fetchDashboardRevenueLeaders('org-1', 'last_week', 5);
    const inventoryTurnover = await fetchDashboardInventoryTurnover('org-1', 2026, 8);
    const products = await fetchDashboardInventoryProducts('org-1', 2026, 10);

    expect(mockedGetData).toHaveBeenNthCalledWith(1, '/v1/dashboard/appointment-leaders/org-1', {
      range: 'last_week',
      limit: 5,
    });
    expect(mockedGetData).toHaveBeenNthCalledWith(2, '/v1/dashboard/revenue-leaders/org-1', {
      range: 'last_week',
      limit: 5,
    });
    expect(mockedGetData).toHaveBeenNthCalledWith(3, '/v1/dashboard/inventory/org-1/turnover', {
      year: 2026,
      targetTurns: 8,
    });
    expect(mockedGetData).toHaveBeenNthCalledWith(4, '/v1/dashboard/inventory/org-1/products', {
      year: 2026,
      limit: 10,
    });

    expect(appointmentLeaders).toHaveLength(1);
    expect(revenueLeaders).toHaveLength(1);
    expect(inventoryTurnover.turnsPerYear).toBe(7.4);
    expect(products).toHaveLength(1);
  });
});
