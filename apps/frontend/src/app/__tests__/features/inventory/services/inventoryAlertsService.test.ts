import { AxiosError } from 'axios';
import {
  fetchLowStockAlerts,
  fetchExpiringAlerts,
  type LowStockAlertItem,
  type ExpiringAlertBatch,
} from '@/app/features/inventory/services/inventoryAlertsService';

const getData = jest.fn();
jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...a: unknown[]) => getData(...a),
}));

const lowItem: LowStockAlertItem = {
  id: 'i-1',
  name: 'Amoxicillin',
  onHand: 2,
  reorderLevel: 10,
};
const batch: ExpiringAlertBatch = {
  id: 'b-1',
  itemId: 'i-1',
  batchNumber: 'LOT-9',
  expiryDate: '2026-10-01T00:00:00.000Z',
  quantity: 5,
};

const LOW = '/v1/inventory/organisation/org-1/alerts/low-stock';
const EXP = '/v1/inventory/organisation/org-1/alerts/expiring';

describe('inventoryAlertsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('fetchLowStockAlerts', () => {
    it('returns the array of items', async () => {
      getData.mockResolvedValue({ data: [lowItem] });
      await expect(fetchLowStockAlerts('org-1')).resolves.toEqual([lowItem]);
      expect(getData).toHaveBeenCalledWith(LOW);
    });
    it('guards a non-array body', async () => {
      getData.mockResolvedValue({ data: { message: 'nope' } });
      await expect(fetchLowStockAlerts('org-1')).resolves.toEqual([]);
      expect(console.warn).toHaveBeenCalled();
    });
    it('logs the axios message and rethrows', async () => {
      const err = new AxiosError('boom');
      err.response = { data: { message: 'down' } } as AxiosError['response'];
      getData.mockRejectedValue(err);
      await expect(fetchLowStockAlerts('org-1')).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load low-stock alerts:', 'down');
    });
    it('falls back to the axios message when there is no response body', async () => {
      const err = new AxiosError('offline');
      getData.mockRejectedValue(err);
      await expect(fetchLowStockAlerts('org-1')).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load low-stock alerts:', 'offline');
    });
    it('logs a non-axios error and rethrows', async () => {
      const err = new Error('raw');
      getData.mockRejectedValue(err);
      await expect(fetchLowStockAlerts('org-1')).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load low-stock alerts:', err);
    });
  });

  describe('fetchExpiringAlerts', () => {
    it('passes the default 30-day window', async () => {
      getData.mockResolvedValue({ data: [batch] });
      await expect(fetchExpiringAlerts('org-1')).resolves.toEqual([batch]);
      expect(getData).toHaveBeenCalledWith(EXP, { days: 30 });
    });
    it('passes an explicit window', async () => {
      getData.mockResolvedValue({ data: [batch] });
      await fetchExpiringAlerts('org-1', 7);
      expect(getData).toHaveBeenCalledWith(EXP, { days: 7 });
    });
    it('guards a non-array body', async () => {
      getData.mockResolvedValue({ data: null });
      await expect(fetchExpiringAlerts('org-1')).resolves.toEqual([]);
      expect(console.warn).toHaveBeenCalled();
    });
    it('logs the axios message and rethrows', async () => {
      const err = new AxiosError('boom');
      err.response = { data: { message: 'gone' } } as AxiosError['response'];
      getData.mockRejectedValue(err);
      await expect(fetchExpiringAlerts('org-1')).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load expiring alerts:', 'gone');
    });
    it('falls back to the axios message when there is no response body', async () => {
      const err = new AxiosError('offline');
      getData.mockRejectedValue(err);
      await expect(fetchExpiringAlerts('org-1')).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load expiring alerts:', 'offline');
    });
    it('logs a non-axios error and rethrows', async () => {
      const err = new Error('raw');
      getData.mockRejectedValue(err);
      await expect(fetchExpiringAlerts('org-1')).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load expiring alerts:', err);
    });
  });
});
