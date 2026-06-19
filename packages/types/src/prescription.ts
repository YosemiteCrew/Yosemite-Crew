export type PrescriptionLineItem = {
  sourceLineKey: string;
  name?: string | null;
  medicationCode?: string | null;
  drugCode?: string | null;
  code?: string | null;
  quantity: number;
  unit?: string | null;
  inventoryItemId?: string | null;
  inventoryItemSku?: string | null;
  batchId?: string | null;
  batchNumber?: string | null;
  lotNumber?: string | null;
  expiryDate?: Date | string | null;
  metadata?: Record<string, unknown> | null;
};

export type PrescriptionInventoryBatchLike = {
  id: string;
  batchNumber: string | null;
  lotNumber: string | null;
  expiryDate: Date | null;
  quantity: number;
  allocated: number;
};

export type MedicationSearchResult = {
  itemId: string;
  organisationId: string;
  name: string;
  code: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  routeOfAdministration: string | null;
  drugClass: string | null;
  prescriptionRequired: boolean;
  controlledItem: boolean;
  expiryTrackingRequired: boolean;
  unitOfMeasure: string | null;
  packageQuantity: number | null;
  onHand: number;
  allocated: number;
  nearestExpiryDate: Date | null;
  batches: PrescriptionInventoryBatchLike[];
};

export type InventoryItemSearchResult = MedicationSearchResult;

export type PrescriptionInventoryAction = 'RESERVE' | 'DISPENSE' | 'RETURN' | 'VOID_DISPENSE';

export type PrescriptionInventoryEventReceipt = {
  id: string;
  organisationId: string;
  sourceType: string;
  sourceId: string;
  sourceLineKey: string | null;
  action: string;
  idempotencyKey: string;
  inventoryItemId: string;
  quantity: number;
  status: string;
  metadata: unknown;
  occurredAt: Date;
};

export type PrescriptionInventoryActionResponse = {
  prescriptionId: string;
  action: PrescriptionInventoryAction;
  inventoryEvents: PrescriptionInventoryEventReceipt[];
};
