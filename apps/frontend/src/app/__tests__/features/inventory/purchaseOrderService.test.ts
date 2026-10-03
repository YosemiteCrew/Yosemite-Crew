import { getData, postData } from '@/app/services/axios';
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createPurchaseOrder,
  fetchOutstandingPurchaseOrderLines,
  fetchPurchaseOrder,
  fetchPurchaseOrders,
  fetchPurchaseOrderVendors,
  receivePurchaseOrderDelivery,
} from '@/app/features/inventory/services/purchaseOrderService';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

const mockedGetData = getData as jest.MockedFunction<typeof getData>;
const mockedPostData = postData as jest.MockedFunction<typeof postData>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetData.mockResolvedValue({ data: [] } as never);
  mockedPostData.mockResolvedValue({ data: { id: 'result-1' } } as never);
});

describe('purchase order requests', () => {
  it('loads suppliers for the selected organisation', async () => {
    await fetchPurchaseOrderVendors('org-1');
    expect(mockedGetData).toHaveBeenCalledWith('/v1/inventory/organisation/org-1/vendors');
  });

  it('loads a page of orders with pagination', async () => {
    await fetchPurchaseOrders('org-1', 2, 50);
    expect(mockedGetData).toHaveBeenCalledWith('/v1/purchase-orders/organisation/org-1', {
      page: 2,
      pageSize: 50,
    });
  });

  it('loads order details', async () => {
    await fetchPurchaseOrder('order-1');
    expect(mockedGetData).toHaveBeenCalledWith('/v1/purchase-orders/order-1');
  });

  it('creates an order for the selected organisation', async () => {
    const input = {
      vendorId: 'vendor-1',
      currency: 'EUR',
      lines: [{ itemId: 'item-1', quantityOrdered: 2, unitCost: 5 }],
    };
    await createPurchaseOrder('org-1', input);
    expect(mockedPostData).toHaveBeenCalledWith('/v1/purchase-orders/organisation/org-1', input);
  });

  it('confirms and cancels an order', async () => {
    await confirmPurchaseOrder('order-1');
    await cancelPurchaseOrder('order-1');
    expect(mockedPostData).toHaveBeenNthCalledWith(1, '/v1/purchase-orders/order-1/confirm');
    expect(mockedPostData).toHaveBeenNthCalledWith(2, '/v1/purchase-orders/order-1/cancel');
  });

  it('records deliveries with their received batch details', async () => {
    const input = {
      idempotencyKey: 'delivery-1',
      lines: [
        {
          purchaseOrderLineId: 'line-1',
          quantityReceived: 2,
          batchNumber: 'batch-1',
          lotNumber: 'lot-1',
          expiryDate: '2027-02-01T00:00:00.000Z',
        },
      ],
    };
    await receivePurchaseOrderDelivery('order-1', input);
    expect(mockedPostData).toHaveBeenCalledWith(
      '/v1/purchase-orders/order-1/receive-delivery',
      input
    );
  });

  it('loads outstanding order lines', async () => {
    await fetchOutstandingPurchaseOrderLines('org-1');
    expect(mockedGetData).toHaveBeenCalledWith(
      '/v1/purchase-orders/organisation/org-1/outstanding'
    );
  });

  it('propagates request errors so the screen can show a failure state', async () => {
    const failure = new Error('request failed');
    mockedGetData.mockRejectedValueOnce(failure);
    await expect(fetchPurchaseOrderVendors('org-1')).rejects.toBe(failure);
  });
});
