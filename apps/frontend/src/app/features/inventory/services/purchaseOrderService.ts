import { getData, postData } from '@/app/services/axios';

export type PurchaseOrderStatus =
  'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export type PurchaseOrderVendor = {
  id: string;
  name: string;
  brand?: string | null;
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  } | null;
};

export type PurchaseOrderLine = {
  id: string;
  itemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityReturned: number;
  unitCost: number;
  totalCost: number;
  packSize: number;
  batchNumber?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
};

export type PurchaseOrder = {
  id: string;
  vendorId: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string | null;
  totalAmount: number;
  currency: string;
  notes?: string | null;
  lines: PurchaseOrderLine[];
};

export type CreatePurchaseOrderInput = {
  vendorId: string;
  expectedDate?: string;
  currency: string;
  notes?: string;
  lines: Array<{
    itemId: string;
    quantityOrdered: number;
    unitCost: number;
    packSize?: number;
    batchNumber?: string;
    lotNumber?: string;
    expiryDate?: string;
  }>;
};

export type ReceivePurchaseOrderDeliveryInput = {
  idempotencyKey: string;
  notes?: string;
  lines: Array<{
    purchaseOrderLineId: string;
    quantityReceived: number;
    batchNumber?: string;
    lotNumber?: string;
    expiryDate?: string;
  }>;
};

export type PurchaseOrderPage = {
  items: PurchaseOrder[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const fetchPurchaseOrderVendors = async (organisationId: string) => {
  const response = await getData<PurchaseOrderVendor[]>(
    `/v1/inventory/organisation/${organisationId}/vendors`
  );
  return response.data;
};

export const fetchPurchaseOrders = async (organisationId: string, page = 1, pageSize = 25) => {
  const response = await getData<PurchaseOrderPage>(
    `/v1/purchase-orders/organisation/${organisationId}`,
    { page, pageSize }
  );
  return response.data;
};

export const fetchPurchaseOrder = async (purchaseOrderId: string) => {
  const response = await getData<PurchaseOrder>(`/v1/purchase-orders/${purchaseOrderId}`);
  return response.data;
};

export const createPurchaseOrder = async (
  organisationId: string,
  input: CreatePurchaseOrderInput
) => {
  const response = await postData<PurchaseOrder, CreatePurchaseOrderInput>(
    `/v1/purchase-orders/organisation/${organisationId}`,
    input
  );
  return response.data;
};

export const confirmPurchaseOrder = async (purchaseOrderId: string) => {
  const response = await postData<PurchaseOrder>(`/v1/purchase-orders/${purchaseOrderId}/confirm`);
  return response.data;
};

export const cancelPurchaseOrder = async (purchaseOrderId: string) => {
  const response = await postData<PurchaseOrder>(`/v1/purchase-orders/${purchaseOrderId}/cancel`);
  return response.data;
};

export const receivePurchaseOrderDelivery = async (
  purchaseOrderId: string,
  input: ReceivePurchaseOrderDeliveryInput
) => {
  const response = await postData<unknown, ReceivePurchaseOrderDeliveryInput>(
    `/v1/purchase-orders/${purchaseOrderId}/receive-delivery`,
    input
  );
  return response.data;
};

export const fetchOutstandingPurchaseOrderLines = async (organisationId: string) => {
  const response = await getData<PurchaseOrderLine[]>(
    `/v1/purchase-orders/organisation/${organisationId}/outstanding`
  );
  return response.data;
};
