import { postData } from '@/app/services/axios';

export type InventoryCount = {
  id: string;
  inventoryBatchId: string | null;
  systemCount: number;
  physicalCount: number;
  discrepancy: number;
  reconciled: boolean;
};

export const recordInventoryBatchCount = async (
  organisationId: string,
  payload: {
    inventoryItemId: string;
    inventoryBatchId: string;
    countedAt: string;
    physicalCount: number;
    notes?: string;
  }
) => {
  const response = await postData<InventoryCount>(
    `/v1/pms/organisation/${organisationId}/inventory-counts`,
    payload
  );
  return response.data;
};

export const reconcileInventoryCount = async (
  organisationId: string,
  countId: string,
  payload: {
    resolution: 'STOCK_ADJUSTED' | 'NO_CHANGE';
    resolutionNotes?: string;
  }
) => {
  const response = await postData<InventoryCount>(
    `/v1/pms/organisation/${organisationId}/inventory-counts/${countId}/reconcile`,
    payload
  );
  return response.data;
};
