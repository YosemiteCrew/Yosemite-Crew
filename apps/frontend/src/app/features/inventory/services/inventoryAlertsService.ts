import axios from 'axios';
import { getData } from '@/app/services/axios';

/**
 * The low-stock endpoint returns raw `InventoryItem` rows the backend has already
 * filtered to `(onHand ?? 0) <= reorderLevel` (reorderLevel truthy). These are the
 * fields the alerts UI reads — the full item carries ~40 more that the panel ignores.
 */
export type LowStockAlertItem = {
  id: string;
  name: string;
  onHand: number;
  reorderLevel: number | null;
  unitOfMeasure?: string | null;
  stockUnitType?: string | null;
  category?: string | null;
  sku?: string | null;
};

/**
 * The expiring endpoint returns raw `InventoryBatch` rows ordered by `expiryDate` asc.
 * `inventoryItem` is typed optional because the current handler does NOT `include` the
 * item relation — the batch carries only `itemId`. Typing it means a later `include`
 * flows through without a UI change; until then the panel falls back to the batch number.
 */
export type ExpiringAlertBatch = {
  id: string;
  itemId: string;
  batchNumber?: string | null;
  expiryDate: string | null;
  quantity: number;
  inventoryItem?: { name?: string | null } | null;
};

export const fetchLowStockAlerts = async (organisationId: string): Promise<LowStockAlertItem[]> => {
  try {
    const res = await getData<LowStockAlertItem[]>(
      `/v1/inventory/organisation/${organisationId}/alerts/low-stock`
    );
    if (!Array.isArray(res.data)) {
      console.warn('Low-stock alerts response is not an array', res.data);
      return [];
    }
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error('Failed to load low-stock alerts:', err.response?.data?.message ?? err.message);
    } else {
      console.error('Failed to load low-stock alerts:', err);
    }
    throw err;
  }
};

export const fetchExpiringAlerts = async (
  organisationId: string,
  days = 30
): Promise<ExpiringAlertBatch[]> => {
  try {
    const res = await getData<ExpiringAlertBatch[]>(
      `/v1/inventory/organisation/${organisationId}/alerts/expiring`,
      { days }
    );
    if (!Array.isArray(res.data)) {
      console.warn('Expiring alerts response is not an array', res.data);
      return [];
    }
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error('Failed to load expiring alerts:', err.response?.data?.message ?? err.message);
    } else {
      console.error('Failed to load expiring alerts:', err);
    }
    throw err;
  }
};
