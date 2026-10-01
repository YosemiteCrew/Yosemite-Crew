import { postData } from '@/app/services/axios';
import {
  recordInventoryBatchCount,
  reconcileInventoryCount,
} from '@/app/features/inventory/services/inventoryCountService';

jest.mock('@/app/services/axios', () => ({ postData: jest.fn() }));

const count = {
  id: 'count-1',
  inventoryBatchId: 'batch-1',
  systemCount: 8,
  physicalCount: 7,
  discrepancy: -1,
  reconciled: false,
};

describe('inventoryCountService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records a batch count and returns the saved record', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: count });
    const payload = {
      inventoryItemId: 'item-1',
      inventoryBatchId: 'batch-1',
      countedAt: '2026-09-27T12:00:00.000Z',
      physicalCount: 7,
    };

    await expect(recordInventoryBatchCount('org-1', payload)).resolves.toEqual(count);
    expect(postData).toHaveBeenCalledWith('/v1/pms/organisation/org-1/inventory-counts', payload);
  });

  it('propagates count recording errors', async () => {
    const error = new Error('offline');
    (postData as jest.Mock).mockRejectedValue(error);
    await expect(
      recordInventoryBatchCount('org-1', {
        inventoryItemId: 'item-1',
        inventoryBatchId: 'batch-1',
        countedAt: '2026-09-27T12:00:00.000Z',
        physicalCount: 7,
      })
    ).rejects.toBe(error);
  });

  it('posts the selected discrepancy resolution and returns the saved record', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { ...count, reconciled: true } });
    const payload = { resolution: 'NO_CHANGE' as const, resolutionNotes: 'Recount pending' };

    await expect(reconcileInventoryCount('org-1', 'count-1', payload)).resolves.toEqual({
      ...count,
      reconciled: true,
    });
    expect(postData).toHaveBeenCalledWith(
      '/v1/pms/organisation/org-1/inventory-counts/count-1/reconcile',
      payload
    );
  });

  it('propagates reconciliation errors', async () => {
    const error = new Error('conflict');
    (postData as jest.Mock).mockRejectedValue(error);
    await expect(
      reconcileInventoryCount('org-1', 'count-1', {
        resolution: 'STOCK_ADJUSTED',
      })
    ).rejects.toBe(error);
  });
});
