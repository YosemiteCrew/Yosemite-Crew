import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PurchaseOrdersContent } from '@/app/features/inventory/pages/PurchaseOrders';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createPurchaseOrder,
  fetchOutstandingPurchaseOrderLines,
  fetchPurchaseOrders,
  fetchPurchaseOrderVendors,
  receivePurchaseOrderDelivery,
} from '@/app/features/inventory/services/purchaseOrderService';

let mockCanEdit = true;
let mockOrganisationId = 'org-1';

jest.mock('@/app/hooks/useLoadOrg', () => ({ useLoadOrg: jest.fn() }));
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string | { allOf?: string[] }) =>
      typeof permission === 'string'
        ? permission === 'inventory:view:any' || mockCanEdit
        : (permission.allOf?.includes('inventory:view:any') ?? false),
  }),
}));
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: { primaryOrgId: string; status: string }) => unknown) =>
    selector({ primaryOrgId: mockOrganisationId, status: 'loaded' }),
}));
jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  fetchInventoryItems: jest.fn(),
}));
jest.mock('@/app/features/inventory/services/purchaseOrderService', () => ({
  cancelPurchaseOrder: jest.fn(),
  confirmPurchaseOrder: jest.fn(),
  createPurchaseOrder: jest.fn(),
  fetchOutstandingPurchaseOrderLines: jest.fn(),
  fetchPurchaseOrders: jest.fn(),
  fetchPurchaseOrderVendors: jest.fn(),
  receivePurchaseOrderDelivery: jest.fn(),
}));

const order = (status: 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' = 'PARTIALLY_RECEIVED') => ({
  id: 'order-1',
  vendorId: 'vendor-1',
  orderNumber: 'PO-001',
  status,
  orderDate: '2026-09-28T09:00:00.000Z',
  expectedDate: '2026-10-06T00:00:00.000Z',
  totalAmount: 90,
  currency: 'EUR',
  notes: 'Handle with care',
  lines: [
    {
      id: 'line-1',
      itemId: 'item-1',
      quantityOrdered: 10,
      quantityReceived: 4,
      quantityReturned: 0,
      unitCost: 9,
      totalCost: 90,
      packSize: 1,
    },
  ],
});

const mockedFetchOrders = jest.mocked(fetchPurchaseOrders);
const mockedFetchVendors = jest.mocked(fetchPurchaseOrderVendors);
const mockedFetchOutstanding = jest.mocked(fetchOutstandingPurchaseOrderLines);
const mockedFetchItems = jest.mocked(fetchInventoryItems);
const mockedCreateOrder = jest.mocked(createPurchaseOrder);
const mockedConfirmOrder = jest.mocked(confirmPurchaseOrder);
const mockedCancelOrder = jest.mocked(cancelPurchaseOrder);
const mockedReceiveDelivery = jest.mocked(receivePurchaseOrderDelivery);

beforeEach(() => {
  jest.clearAllMocks();
  mockCanEdit = true;
  mockOrganisationId = 'org-1';
  mockedFetchOrders.mockResolvedValue({
    items: [order()],
    page: 1,
    pageSize: 25,
    total: 1,
    totalPages: 1,
  });
  mockedFetchVendors.mockResolvedValue([{ id: 'vendor-1', name: 'North Shore Supply' }]);
  mockedFetchItems.mockResolvedValue([
    {
      _id: 'item-1',
      name: 'Amoxicillin',
      unitCost: 9,
      organisationId: 'org-1',
      businessType: 'HOSPITAL',
    },
  ]);
  mockedFetchOutstanding.mockResolvedValue([order().lines[0]]);
  mockedCreateOrder.mockResolvedValue(order('DRAFT'));
  mockedConfirmOrder.mockResolvedValue(order('CONFIRMED'));
  mockedCancelOrder.mockResolvedValue(order('DRAFT'));
  mockedReceiveDelivery.mockResolvedValue({ id: 'delivery-1' });
});

describe('PurchaseOrdersContent', () => {
  it('shows the empty state without requesting data when there is no organisation', async () => {
    mockOrganisationId = '';
    render(<PurchaseOrdersContent />);

    expect(await screen.findByText('No purchase orders yet')).toBeVisible();
    expect(mockedFetchOrders).not.toHaveBeenCalled();
    expect(mockedFetchVendors).not.toHaveBeenCalled();
    expect(mockedFetchItems).not.toHaveBeenCalled();
    expect(mockedFetchOutstanding).not.toHaveBeenCalled();
  });

  it('loads orders and shows outstanding quantities', async () => {
    render(<PurchaseOrdersContent />);
    expect(await screen.findByText('PO-001')).toBeVisible();
    expect(screen.getByText('28/09/2026')).toBeVisible();
    expect(screen.getByText('06/10/2026')).toBeVisible();
    expect(screen.getByText('6 units')).toBeVisible();
    expect(screen.getByText('North Shore Supply')).toBeVisible();
    expect(screen.getByText('6', { selector: 'p' })).toBeVisible();
    expect(mockedFetchOrders).toHaveBeenCalledWith('org-1', 1);
  });

  it('creates a draft with its selected supplier, product, and expected date', async () => {
    const user = userEvent.setup();
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'New order' }));
    await user.selectOptions(screen.getByLabelText('Supplier'), 'vendor-1');
    await user.selectOptions(screen.getByLabelText('Product'), 'item-1');
    await user.clear(screen.getByLabelText('Quantity'));
    await user.type(screen.getByLabelText('Quantity'), '3');
    await user.clear(screen.getByLabelText('Unit cost'));
    await user.type(screen.getByLabelText('Unit cost'), '12.50');
    await user.type(screen.getByLabelText('Expected delivery'), '2026-10-06');
    await user.type(screen.getByLabelText('Notes'), 'Arrive before Friday');
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(mockedCreateOrder).toHaveBeenCalledWith('org-1', {
        vendorId: 'vendor-1',
        currency: 'GBP',
        expectedDate: '2026-10-06T00:00:00.000Z',
        notes: 'Arrive before Friday',
        lines: [{ itemId: 'item-1', quantityOrdered: 3, unitCost: 12.5 }],
      })
    );
  });

  it('adds and removes order lines without removing the required final line', async () => {
    const user = userEvent.setup();
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'New order' }));
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getAllByLabelText('Product')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect(screen.getAllByLabelText('Product')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove item 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'New supplier order' })).not.toBeInTheDocument();
  });

  it('preserves the remaining draft line DOM when an earlier line is removed', async () => {
    const user = userEvent.setup();
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'New order' }));
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const secondLineQuantity = screen.getAllByLabelText('Quantity')[1];

    await user.click(screen.getByRole('button', { name: 'Remove item 1' }));

    expect(screen.getAllByLabelText('Quantity')).toHaveLength(1);
    expect(screen.getByLabelText('Quantity')).toBe(secondLineQuantity);
  });

  it('confirms a draft and cancels it through their explicit actions', async () => {
    const user = userEvent.setup();
    mockedFetchOrders.mockResolvedValue({
      items: [order('DRAFT')],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('heading', { name: 'Review PO-001' })).toBeVisible();
    expect(screen.getByText('10 ordered · 4 received · 6 outstanding')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('heading', { name: 'Review PO-001' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await screen.findByRole('heading', { name: 'Review PO-001' });
    await user.click(screen.getByRole('button', { name: 'Confirm order' }));
    await waitFor(() => expect(mockedConfirmOrder).toHaveBeenCalledWith('order-1'));
    await user.click(screen.getByRole('button', { name: 'Cancel PO-001' }));
    await waitFor(() => expect(mockedCancelOrder).toHaveBeenCalledWith('order-1'));
  });

  it('keeps the order form open and reports a create failure', async () => {
    const user = userEvent.setup();
    mockedCreateOrder.mockRejectedValueOnce(new Error('offline'));
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'New order' }));
    await user.selectOptions(screen.getByLabelText('Supplier'), 'vendor-1');
    await user.selectOptions(screen.getByLabelText('Product'), 'item-1');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is still here.');
    expect(screen.getByRole('heading', { name: 'New supplier order' })).toBeVisible();
  });

  it('retries loading purchase orders after a failure', async () => {
    const user = userEvent.setup();
    mockedFetchOrders.mockRejectedValueOnce(new Error('offline'));
    render(<PurchaseOrdersContent />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Purchase orders could not be loaded. Try again.'
    );

    await user.click(screen.getByRole('button', { name: 'Retry loading' }));

    expect(await screen.findByText('PO-001')).toBeVisible();
    expect(mockedFetchOrders).toHaveBeenCalledTimes(2);
  });

  it('moves through purchase-order pages', async () => {
    const user = userEvent.setup();
    mockedFetchOrders.mockImplementation(async (_organisationId, requestedPage = 1) => ({
      items: [order()],
      page: requestedPage,
      pageSize: 25,
      total: 26,
      totalPages: 2,
    }));
    render(<PurchaseOrdersContent />);
    await screen.findByText('Page 1 of 2');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');
    expect(mockedFetchOrders).toHaveBeenLastCalledWith('org-1', 2);
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Page 1 of 2');
    expect(mockedFetchOrders).toHaveBeenLastCalledWith('org-1', 1);
  });

  it('returns to the first page after creating an order from a later page', async () => {
    const user = userEvent.setup();
    mockedFetchOrders.mockImplementation(async (_organisationId, requestedPage = 1) => ({
      items: [order()],
      page: requestedPage,
      pageSize: 25,
      total: 26,
      totalPages: 2,
    }));
    render(<PurchaseOrdersContent />);
    await screen.findByText('Page 1 of 2');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');
    await user.click(screen.getByRole('button', { name: 'New order' }));
    await user.selectOptions(screen.getByLabelText('Supplier'), 'vendor-1');
    await user.selectOptions(screen.getByLabelText('Product'), 'item-1');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Page 1 of 2')).toBeVisible();
    expect(mockedFetchOrders).toHaveBeenLastCalledWith('org-1', 1);
  });

  it('records delivered quantity and the batch details', async () => {
    const user = userEvent.setup();
    const multiLineOrder = order();
    multiLineOrder.lines.push({ ...multiLineOrder.lines[0], id: 'line-2', itemId: 'item-2' });
    mockedFetchOrders.mockResolvedValueOnce({
      items: [multiLineOrder],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('heading', { name: 'Review PO-001' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirm order' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Receive' }));
    const quantities = screen.getAllByLabelText('Quantity received');
    const batchNumbers = screen.getAllByLabelText('Batch number');
    const lotNumbers = screen.getAllByLabelText('Lot number');
    const expiryDates = screen.getAllByLabelText('Expiry date');
    await user.clear(quantities[0]);
    await user.type(quantities[0], '2');
    await user.type(batchNumbers[0], ' B-120 ');
    await user.type(lotNumbers[0], ' L-5 ');
    await user.type(expiryDates[0], '2027-02-01');
    expect(quantities[1]).toHaveValue(6);
    expect(batchNumbers[1]).toHaveValue('');
    expect(lotNumbers[1]).toHaveValue('');
    expect(expiryDates[1]).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Record delivery' }));
    await waitFor(() =>
      expect(mockedReceiveDelivery).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({
          idempotencyKey: expect.any(String),
          lines: [
            {
              purchaseOrderLineId: 'line-1',
              quantityReceived: 2,
              batchNumber: 'B-120',
              lotNumber: 'L-5',
              expiryDate: '2027-02-01T00:00:00.000Z',
            },
            { purchaseOrderLineId: 'line-2', quantityReceived: 6 },
          ],
        })
      )
    );
  });

  it('closes the receiving dialog when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Receive' }));
    expect(await screen.findByRole('heading', { name: 'Receive PO-001' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Receive PO-001' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Receive' }));
    expect(await screen.findByRole('heading', { name: 'Receive PO-001' })).toBeVisible();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('heading', { name: 'Receive PO-001' })).not.toBeInTheDocument();
  });

  it('does not count returned units twice when showing outstanding quantity', async () => {
    const user = userEvent.setup();
    const partiallyReturnedOrder = order('PARTIALLY_RECEIVED');
    partiallyReturnedOrder.lines[0] = {
      ...partiallyReturnedOrder.lines[0],
      quantityReceived: 2,
      quantityReturned: 2,
    };
    mockedFetchOrders.mockResolvedValue({
      items: [partiallyReturnedOrder],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });

    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Receive' }));

    expect(screen.getByLabelText('Quantity received')).toHaveValue(8);
  });

  it('lets read-only staff review a draft without confirming it', async () => {
    const user = userEvent.setup();
    mockCanEdit = false;
    mockedFetchOrders.mockResolvedValue({
      items: [order('DRAFT')],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });

    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Review' }));

    expect(await screen.findByRole('heading', { name: 'Review PO-001' })).toBeVisible();
    expect(
      screen.getByText('Review the supplier, quantities, and total for this order.')
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirm order' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('heading', { name: 'Review PO-001' })).not.toBeInTheDocument();
  });

  it('does not submit an empty receipt', async () => {
    const user = userEvent.setup();
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Receive' }));
    await user.clear(screen.getByLabelText('Quantity received'));
    await user.type(screen.getByLabelText('Quantity received'), '0');
    await user.click(screen.getByRole('button', { name: 'Record delivery' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a quantity for at least one item.'
    );
    expect(mockedReceiveDelivery).not.toHaveBeenCalled();
  });

  it('reuses the same receipt idempotency key when a delivery retry is needed', async () => {
    const user = userEvent.setup();
    const randomUUID = jest.spyOn(crypto, 'randomUUID').mockReturnValue('stable-receipt-key');
    mockedReceiveDelivery.mockRejectedValueOnce(new Error('timeout'));
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Receive' }));
    await user.click(screen.getByRole('button', { name: 'Record delivery' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Record delivery' }));
    await waitFor(() => expect(mockedReceiveDelivery).toHaveBeenCalledTimes(2));
    expect(mockedReceiveDelivery.mock.calls[0][1].idempotencyKey).toBe('stable-receipt-key');
    expect(mockedReceiveDelivery.mock.calls[1][1].idempotencyKey).toBe('stable-receipt-key');
    randomUUID.mockRestore();
  });

  it('reports a confirmation failure without hiding the order', async () => {
    const user = userEvent.setup();
    mockedFetchOrders.mockResolvedValue({
      items: [order('DRAFT')],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });
    mockedConfirmOrder.mockRejectedValueOnce(new Error('offline'));
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await screen.findByRole('heading', { name: 'Review PO-001' });
    await user.click(screen.getByRole('button', { name: 'Confirm order' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'The order could not be confirmed.'
    );
    expect(screen.getByText('PO-001')).toBeVisible();
  });

  it('shows an actionable message when the order list cannot load', async () => {
    mockedFetchOrders.mockRejectedValueOnce(new Error('offline'));
    render(<PurchaseOrdersContent />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Purchase orders could not be loaded. Try again.'
    );
  });

  it('prints the selected order document', async () => {
    const user = userEvent.setup();
    const print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<PurchaseOrdersContent />);
    await screen.findByText('PO-001');
    await user.click(screen.getByRole('button', { name: 'Print PO-001' }));
    await waitFor(() => expect(print).toHaveBeenCalled());
    print.mockRestore();
  });

  it('keeps the empty state useful when there are no orders', async () => {
    mockedFetchOrders.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
    });
    render(<PurchaseOrdersContent />);
    expect(await screen.findByText('No purchase orders yet')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create first order' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Create first order' }));
    expect(await screen.findByRole('heading', { name: 'New supplier order' })).toBeVisible();
  });
});
