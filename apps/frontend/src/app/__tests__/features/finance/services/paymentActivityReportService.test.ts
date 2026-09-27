import api from '@/app/services/axios';
import {
  downloadPaymentActivityReport,
  fetchPaymentActivityReport,
} from '@/app/features/finance/services/paymentActivityReportService';

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const report = { rows: [], totals: [] };
const get = api.get as jest.Mock;

beforeEach(() => get.mockReset());

describe('payment activity report service', () => {
  it('fetches the report for an encoded organisation and date range', async () => {
    get.mockResolvedValue({ data: { data: report } });

    await expect(
      fetchPaymentActivityReport('org/1', '2026-09-01T00:00:00.000Z', '2026-09-30T23:59:59.999Z')
    ).resolves.toBe(report);

    expect(get).toHaveBeenCalledWith('/v1/finance/organisation/org%2F1/reports/payment-activity', {
      params: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T23:59:59.999Z' },
    });
  });

  it('returns the downloaded file and requests the selected format', async () => {
    const blob = new Blob(['csv']);
    get.mockResolvedValue({ data: blob });

    await expect(downloadPaymentActivityReport('org-1', 'from', 'to', 'csv')).resolves.toBe(blob);

    expect(get).toHaveBeenCalledWith('/v1/finance/organisation/org-1/reports/payment-activity', {
      params: { from: 'from', to: 'to', format: 'csv' },
      responseType: 'blob',
    });
  });

  it('propagates request failures for report and export calls', async () => {
    const failure = new Error('Request failed');
    get.mockRejectedValue(failure);

    await expect(fetchPaymentActivityReport('org-1', 'from', 'to')).rejects.toBe(failure);
    await expect(downloadPaymentActivityReport('org-1', 'from', 'to', 'pdf')).rejects.toBe(failure);
  });
});
