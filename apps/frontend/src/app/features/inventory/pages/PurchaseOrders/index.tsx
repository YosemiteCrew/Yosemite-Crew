'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { IoAddOutline, IoPrintOutline, IoTrashOutline } from 'react-icons/io5';
import Button from '@/app/ui/Button';
import Card from '@/app/ui/Card';
import Input from '@/app/ui/Input';
import { Textarea } from '@/app/ui/Input';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import PermissionGate from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import Modal from '@/app/ui/overlays/Modal';
import { useLoadOrg } from '@/app/hooks/useLoadOrg';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useOrgStore } from '@/app/stores/orgStore';
import { PERMISSIONS } from '@/app/lib/permissions';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createPurchaseOrder,
  fetchOutstandingPurchaseOrderLines,
  fetchPurchaseOrders,
  fetchPurchaseOrderVendors,
  receivePurchaseOrderDelivery,
  type CreatePurchaseOrderInput,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type PurchaseOrderVendor,
} from '@/app/features/inventory/services/purchaseOrderService';
import type { InventoryApiItem } from '@/app/features/inventory/pages/Inventory/types';

type DraftLine = { id: string; itemId: string; quantityOrdered: number; unitCost: number };
type ReceiptDraftLine = {
  purchaseOrderLineId: string;
  quantityReceived: number;
  batchNumber: string;
  lotNumber: string;
  expiryDate: string;
};
type CreateOrderForm = {
  show: boolean;
  vendorId: string;
  currency: string;
  expectedDate: string;
  notes: string;
  lines: DraftLine[];
};
type ReceiveOrderForm = { order: PurchaseOrder | null; lines: ReceiptDraftLine[] };
type PurchaseOrderData = {
  orders: PurchaseOrder[];
  page: number;
  totalOrderCount: number;
  totalPages: number;
  vendors: PurchaseOrderVendor[];
  items: InventoryApiItem[];
  outstandingLines: PurchaseOrderLine[];
};
type StateUpdate<T> = Partial<T> | ((current: T) => Partial<T>);

const mergeState = <T,>(current: T, update: StateUpdate<T>): T => ({
  ...current,
  ...(typeof update === 'function' ? update(current) : update),
});

const createDraftLine = (): DraftLine => ({
  id: crypto.randomUUID(),
  itemId: '',
  quantityOrdered: 1,
  unitCost: 0,
});

const statusTone: Record<PurchaseOrder['status'], StatusTone> = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

const outstandingQuantity = (line: PurchaseOrderLine) =>
  Math.max(0, line.quantityOrdered - line.quantityReceived);

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : 'Not set';

const moneyFormatters = new Map<string, Intl.NumberFormat>();

const formatMoney = (amount: number, currency: string) => {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
};

type PurchaseOrderFormProps = {
  form: CreateOrderForm;
  vendors: PurchaseOrderVendor[];
  items: InventoryApiItem[];
  itemById: Map<string, InventoryApiItem>;
  saving: boolean;
  onFormChange: (update: StateUpdate<CreateOrderForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const PurchaseOrderForm = ({
  form,
  vendors,
  items,
  itemById,
  saving,
  onFormChange,
  onSubmit,
}: PurchaseOrderFormProps) => {
  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    onFormChange((current) => ({
      lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));

  if (!form.show) return null;

  return (
    <Card className="p-4 sm:p-6">
      <section>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">New supplier order</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Review the order details before confirming it.
              </p>
            </div>
            <label className="grid gap-1 text-sm text-text-secondary">
              Supplier
              <select
                required
                value={form.vendorId}
                onChange={(event) => onFormChange({ vendorId: event.target.value })}
                className="h-10 min-w-56 rounded-xl border border-card-border bg-neutral-0 px-3 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
              >
                <option value="">Choose a supplier</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {vendors.length === 0 && (
            <p className="text-sm text-text-secondary">
              Add a supplier in Inventory before creating an order.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm text-text-secondary">
              Expected delivery
              <Input
                type="date"
                placeholder="Expected delivery"
                value={form.expectedDate}
                onChange={(event) => onFormChange({ expectedDate: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm text-text-secondary">
              Currency
              <select
                value={form.currency}
                onChange={(event) => onFormChange({ currency: event.target.value })}
                className="h-10 rounded-xl border border-card-border bg-neutral-0 px-3 text-text-primary"
              >
                <option>EUR</option>
                <option>GBP</option>
                <option>USD</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-text-secondary">
              Notes
              <Textarea
                value={form.notes}
                onChange={(event) => onFormChange({ notes: event.target.value })}
                rows={2}
                maxLength={500}
                placeholder="Optional note for this order"
              />
            </label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Items</h3>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-text hover:underline"
                onClick={() =>
                  onFormChange((current) => ({
                    lines: [...current.lines, createDraftLine()],
                  }))
                }
              >
                <IoAddOutline aria-hidden="true" /> Add item
              </button>
            </div>
            {form.lines.map((line, index) => (
              <div
                key={line.id}
                className="grid gap-2 rounded-xl border border-card-border p-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] sm:items-end"
              >
                <label className="grid gap-1 text-sm text-text-secondary">
                  Product
                  <select
                    required
                    value={line.itemId}
                    onChange={(event) =>
                      updateLine(line.id, {
                        itemId: event.target.value,
                        unitCost: Number(itemById.get(event.target.value)?.unitCost ?? 0),
                      })
                    }
                    className="h-10 min-w-0 rounded-xl border border-card-border bg-neutral-0 px-3 text-text-primary"
                  >
                    <option value="">Choose a product</option>
                    {items.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm text-text-secondary">
                  Quantity
                  <Input
                    required
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Quantity"
                    value={line.quantityOrdered}
                    onChange={(event) =>
                      updateLine(line.id, { quantityOrdered: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm text-text-secondary">
                  Unit cost
                  <Input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Unit cost"
                    value={line.unitCost}
                    onChange={(event) =>
                      updateLine(line.id, { unitCost: Number(event.target.value) })
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={form.lines.length === 1}
                  onClick={() =>
                    onFormChange((current) => ({
                      lines: current.lines.filter((draft) => draft.id !== line.id),
                    }))
                  }
                  className="inline-flex size-10 items-center justify-center rounded-xl text-text-secondary hover:bg-card-hover disabled:opacity-40"
                >
                  <IoTrashOutline aria-hidden="true" />
                </button>
              </div>
            ))}
            <p className="text-right text-sm font-semibold text-text-primary">
              Estimated total{' '}
              {formatMoney(
                form.lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0),
                form.currency
              )}
            </p>
          </div>
          {items.length === 0 && (
            <p className="text-sm text-text-secondary">
              Add products to Inventory before creating an order.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              text="Cancel"
              variant="secondary"
              onClick={() => onFormChange({ show: false })}
            />
            <Button
              text={saving ? 'Saving…' : 'Save draft'}
              type="submit"
              isDisabled={saving || !vendors.length || !items.length}
            />
          </div>
        </form>
      </section>
    </Card>
  );
};

type OrderHistoryProps = {
  orders: PurchaseOrder[];
  page: number;
  totalOrderCount: number;
  totalPages: number;
  loading: boolean;
  canEdit: boolean;
  vendorById: Map<string, PurchaseOrderVendor>;
  onCreate: () => void;
  onPageChange: (page: number) => void;
  onPrint: (order: PurchaseOrder) => void;
  onReview: (order: PurchaseOrder) => void;
  onReceive: (order: PurchaseOrder) => void;
  onCancel: (order: PurchaseOrder) => void;
};

const OrderHistory = ({
  orders,
  page,
  totalOrderCount,
  totalPages,
  loading,
  canEdit,
  vendorById,
  onCreate,
  onPageChange,
  onPrint,
  onReview,
  onReceive,
  onCancel,
}: OrderHistoryProps) => (
  <Card className="overflow-hidden">
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Order history</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Confirmed quantities stay in the record as deliveries arrive.
          </p>
        </div>
        <span className="text-sm text-text-secondary">
          {totalOrderCount
            ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, totalOrderCount)} of ${totalOrderCount} orders`
            : '0 orders'}
        </span>
      </div>
      {orders.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-base font-semibold text-text-primary">No purchase orders yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Create a draft when you are ready to replenish stock.
          </p>
          {canEdit && <Button className="mt-4" text="Create first order" onClick={onCreate} />}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-card-bg text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3 sm:px-6">Order</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {orders.map((order) => (
                <tr key={order.id} className="align-middle">
                  <td className="px-4 py-4 font-semibold text-text-primary sm:px-6">
                    {order.orderNumber}
                    <span className="mt-1 block text-xs font-normal text-text-secondary">
                      {formatDate(order.orderDate)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-text-primary">
                    {vendorById.get(order.vendorId)?.name ?? 'Supplier'}
                  </td>
                  <td className="px-4 py-4 text-text-secondary">
                    {formatDate(order.expectedDate)}
                  </td>
                  <td className="px-4 py-4 text-text-primary">
                    {order.lines.reduce((sum, line) => sum + outstandingQuantity(line), 0)} units
                  </td>
                  <td className="px-4 py-4 text-text-primary">
                    {formatMoney(order.totalAmount, order.currency)}
                  </td>
                  <td className="px-4 py-4">
                    <StatusPill
                      label={order.status.replaceAll('_', ' ')}
                      tone={statusTone[order.status]}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Print ${order.orderNumber}`}
                        onClick={() => onPrint(order)}
                        className="rounded-lg p-2 text-text-secondary hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
                      >
                        <IoPrintOutline aria-hidden="true" />
                      </button>
                      <Button
                        text="Review"
                        variant="secondary"
                        className="!h-9 !px-3"
                        onClick={() => onReview(order)}
                      />
                      {canEdit && ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status) && (
                        <Button
                          text="Receive"
                          className="!h-9 !px-3"
                          onClick={() => onReceive(order)}
                        />
                      )}
                      {canEdit && order.status === 'DRAFT' && (
                        <button
                          type="button"
                          aria-label={`Cancel ${order.orderNumber}`}
                          onClick={() => onCancel(order)}
                          className="rounded-lg p-2 text-text-secondary hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
                        >
                          <IoTrashOutline aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <nav
          aria-label="Purchase order pages"
          className="flex items-center justify-between border-t border-card-border px-4 py-3 sm:px-6"
        >
          <Button
            text="Previous"
            variant="secondary"
            className="!h-9 !px-3"
            isDisabled={page === 1 || loading}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          />
          <span className="text-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <Button
            text="Next"
            variant="secondary"
            className="!h-9 !px-3"
            isDisabled={page >= totalPages || loading}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          />
        </nav>
      )}
    </section>
  </Card>
);

type ReviewOrderDialogProps = {
  order: PurchaseOrder | null;
  canEdit: boolean;
  saving: boolean;
  error: string | null;
  vendorById: Map<string, PurchaseOrderVendor>;
  itemById: Map<string, InventoryApiItem>;
  onClose: () => void;
  onConfirm: (order: PurchaseOrder) => void;
};

const ReviewOrderDialog = ({
  order,
  canEdit,
  saving,
  error,
  vendorById,
  itemById,
  onClose,
  onConfirm,
}: ReviewOrderDialogProps) => (
  <Modal
    showModal={Boolean(order)}
    setShowModal={(show) => {
      if (!show) onClose();
    }}
    onClose={onClose}
    variant="centered"
    size="md"
    aria-labelledby="review-order-title"
  >
    {order && (
      <section className="max-h-[90vh] overflow-y-auto space-y-5">
        <div>
          <h2 id="review-order-title" className="text-lg font-semibold text-text-primary">
            Review {order.orderNumber}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {canEdit && order.status === 'DRAFT'
              ? 'Check the supplier, quantities, and total before confirming this order.'
              : 'Review the supplier, quantities, and total for this order.'}
          </p>
        </div>
        <dl className="grid gap-3 rounded-xl border border-card-border p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">Supplier</dt>
            <dd className="font-medium text-text-primary">
              {vendorById.get(order.vendorId)?.name ?? 'Supplier'}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Expected</dt>
            <dd className="font-medium text-text-primary">{formatDate(order.expectedDate)}</dd>
          </div>
        </dl>
        <ul className="divide-y divide-card-border rounded-xl border border-card-border">
          {order.lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-text-primary">
                  {itemById.get(line.itemId)?.name ?? 'Inventory item'}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {line.quantityOrdered} ordered · {line.quantityReceived} received ·{' '}
                  {outstandingQuantity(line)} outstanding
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-text-primary">
                {formatMoney(line.totalCost, order.currency)}
              </span>
            </li>
          ))}
        </ul>
        {order.notes && (
          <p className="rounded-xl bg-card-bg p-4 text-sm text-text-secondary">{order.notes}</p>
        )}
        <p className="text-right font-semibold text-text-primary">
          Total {formatMoney(order.totalAmount, order.currency)}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            text={canEdit && order.status === 'DRAFT' ? 'Back' : 'Close'}
            variant="secondary"
            isDisabled={saving}
            onClick={onClose}
          />
          {canEdit && order.status === 'DRAFT' && (
            <Button
              text={saving ? 'Confirming…' : 'Confirm order'}
              isDisabled={saving}
              onClick={() => onConfirm(order)}
            />
          )}
        </div>
      </section>
    )}
  </Modal>
);

type ReceiveOrderDialogProps = {
  order: PurchaseOrder | null;
  lines: ReceiptDraftLine[];
  itemById: Map<string, InventoryApiItem>;
  saving: boolean;
  onClose: () => void;
  onChange: (update: StateUpdate<ReceiveOrderForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const ReceiveOrderDialog = ({
  order,
  lines,
  itemById,
  saving,
  onClose,
  onChange,
  onSubmit,
}: ReceiveOrderDialogProps) => (
  <Modal
    showModal={Boolean(order)}
    setShowModal={(show) => {
      if (!show) onClose();
    }}
    onClose={onClose}
    variant="centered"
    size="lg"
    aria-labelledby="receive-order-title"
  >
    {order && (
      <section className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <h2 id="receive-order-title" className="text-lg font-semibold text-text-primary">
              Receive {order.orderNumber}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Record the quantities and the batch details on the delivery.
            </p>
          </div>
          {lines.map((line) => {
            const orderLine = order.lines.find((item) => item.id === line.purchaseOrderLineId);
            if (!orderLine) return null;
            const updateLine = (patch: Partial<ReceiptDraftLine>) =>
              onChange((current) => ({
                lines: current.lines.map((draft) =>
                  draft.purchaseOrderLineId === line.purchaseOrderLineId
                    ? { ...draft, ...patch }
                    : draft
                ),
              }));
            return (
              <fieldset
                key={line.purchaseOrderLineId}
                className="grid gap-3 rounded-xl border border-card-border p-3 sm:grid-cols-2"
              >
                <legend className="px-1 text-sm font-semibold text-text-primary">
                  {itemById.get(orderLine.itemId)?.name ?? 'Inventory item'} ·{' '}
                  {outstandingQuantity(orderLine)} outstanding
                </legend>
                <label className="grid gap-1 text-sm text-text-secondary">
                  Quantity received
                  <Input
                    type="number"
                    min={0}
                    max={outstandingQuantity(orderLine)}
                    step={1}
                    placeholder="Quantity received"
                    value={line.quantityReceived}
                    onChange={(event) =>
                      updateLine({ quantityReceived: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm text-text-secondary">
                  Batch number
                  <Input
                    placeholder="Batch number"
                    value={line.batchNumber}
                    onChange={(event) => updateLine({ batchNumber: event.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-sm text-text-secondary">
                  Lot number
                  <Input
                    placeholder="Lot number"
                    value={line.lotNumber}
                    onChange={(event) => updateLine({ lotNumber: event.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-sm text-text-secondary">
                  Expiry date
                  <Input
                    type="date"
                    placeholder="Expiry date"
                    value={line.expiryDate}
                    onChange={(event) => updateLine({ expiryDate: event.target.value })}
                  />
                </label>
              </fieldset>
            );
          })}
          <div className="flex justify-end gap-2">
            <Button text="Cancel" variant="secondary" onClick={onClose} />
            <Button
              text={saving ? 'Saving…' : 'Record delivery'}
              type="submit"
              isDisabled={saving}
            />
          </div>
        </form>
      </section>
    )}
  </Modal>
);

type PurchaseOrderPrintViewProps = {
  order: PurchaseOrder | null;
  vendorById: Map<string, PurchaseOrderVendor>;
  itemById: Map<string, InventoryApiItem>;
};

const PurchaseOrderPrintView = ({ order, vendorById, itemById }: PurchaseOrderPrintViewProps) =>
  order ? (
    <>
      <section
        className="purchase-order-print hidden print:fixed print:inset-0 print:block p-8 text-black"
        aria-label="Purchase order document"
      >
        <div className="flex justify-between border-b border-black pb-5">
          <div>
            <p className="text-xs uppercase tracking-widest">Supplier order</p>
            <h1 className="mt-2 text-3xl font-semibold">{order.orderNumber}</h1>
          </div>
          <div className="text-right">
            <p>{vendorById.get(order.vendorId)?.name ?? 'Supplier'}</p>
            <p className="mt-1">Order date: {formatDate(order.orderDate)}</p>
            <p>Expected: {formatDate(order.expectedDate)}</p>
          </div>
        </div>
        <table className="mt-8 w-full text-left">
          <thead>
            <tr className="border-b border-black">
              <th className="py-2">Product</th>
              <th>Quantity</th>
              <th>Unit cost</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-card-border">
                <td className="py-3">{itemById.get(line.itemId)?.name ?? 'Inventory item'}</td>
                <td>{line.quantityOrdered}</td>
                <td>{formatMoney(line.unitCost, order.currency)}</td>
                <td>{formatMoney(line.totalCost, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.notes && <p className="mt-6">Notes: {order.notes}</p>}
        <p className="mt-8 text-right text-xl font-semibold">
          Total: {formatMoney(order.totalAmount, order.currency)}
        </p>
      </section>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .purchase-order-print,
          .purchase-order-print * {
            visibility: visible !important;
          }
          .purchase-order-print {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </>
  ) : null;

export const PurchaseOrdersContent = () => {
  useLoadOrg();
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const canEdit = usePermissions().can(PERMISSIONS.INVENTORY_EDIT_ANY);
  const [data, updateData] = useReducer(mergeState<PurchaseOrderData>, {
    orders: [],
    page: 1,
    totalOrderCount: 0,
    totalPages: 1,
    vendors: [],
    items: [],
    outstandingLines: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [createForm, updateCreateForm] = useReducer(mergeState<CreateOrderForm>, {
    show: false,
    vendorId: '',
    currency: 'EUR',
    expectedDate: '',
    notes: '',
    lines: [createDraftLine()],
  });
  const [reviewingOrder, setReviewingOrder] = useState<PurchaseOrder | null>(null);
  const [receiveForm, updateReceiveForm] = useReducer(mergeState<ReceiveOrderForm>, {
    order: null,
    lines: [],
  });
  const receiptIdempotencyKey = useRef('');
  const [printOrder, setPrintOrder] = useState<PurchaseOrder | null>(null);
  const { orders, page, totalOrderCount, totalPages, vendors, items, outstandingLines } = data;
  const {
    show: showCreateForm,
    vendorId,
    currency,
    expectedDate,
    notes,
    lines: draftLines,
  } = createForm;
  const { order: receivingOrder, lines: receiptLines } = receiveForm;

  const loadData = useCallback(async () => {
    if (!organisationId) {
      updateData({
        orders: [],
        totalOrderCount: 0,
        totalPages: 1,
        vendors: [],
        items: [],
        outstandingLines: [],
      });
      setLoading(false);
      return;
    }
    setError(null);
    setLoadFailed(false);
    setLoading(true);
    try {
      const [orderPage, supplierList, inventory, outstanding] = await Promise.all([
        fetchPurchaseOrders(organisationId, page),
        fetchPurchaseOrderVendors(organisationId),
        fetchInventoryItems(organisationId),
        fetchOutstandingPurchaseOrderLines(organisationId),
      ]);
      updateData({
        orders: orderPage.items,
        totalOrderCount: orderPage.total,
        totalPages: orderPage.totalPages,
        vendors: supplierList,
        items: inventory,
        outstandingLines: outstanding,
      });
    } catch {
      setError('Purchase orders could not be loaded. Try again.');
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [organisationId, page]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  useEffect(() => {
    if (!printOrder) return;
    const frame = window.requestAnimationFrame(() => {
      window.print();
      setPrintOrder(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printOrder]);

  const itemById = useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);
  const vendorById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors]
  );
  const outstandingUnits = outstandingLines.reduce(
    (sum, line) => sum + outstandingQuantity(line),
    0
  );
  const openOrders = orders.filter((order) =>
    ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status)
  );
  const committedSpend = openOrders.reduce<Record<string, number>>(
    (totals, order) => ({
      ...totals,
      [order.currency]: (totals[order.currency] ?? 0) + order.totalAmount,
    }),
    {}
  );

  const closeReceiving = () => updateReceiveForm({ order: null, lines: [] });

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organisationId || !vendorId || draftLines.some((line) => !line.itemId)) return;
    setSaving(true);
    setError(null);
    try {
      const input: CreatePurchaseOrderInput = {
        vendorId,
        currency,
        ...(expectedDate
          ? { expectedDate: new Date(`${expectedDate}T00:00:00.000Z`).toISOString() }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: draftLines.map(({ itemId, quantityOrdered, unitCost }) => ({
          itemId,
          quantityOrdered,
          unitCost,
        })),
      };
      await createPurchaseOrder(organisationId, input);
      updateCreateForm({
        show: false,
        vendorId: '',
        expectedDate: '',
        notes: '',
        lines: [createDraftLine()],
      });
      if (page === 1) await loadData();
      else updateData({ page: 1 });
    } catch {
      setError('The purchase order could not be saved. Your draft is still here.');
    } finally {
      setSaving(false);
    }
  };

  const runOrderAction = async (action: () => Promise<unknown>, failure: string) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      setReviewingOrder(null);
      updateReceiveForm({ order: null, lines: [] });
      receiptIdempotencyKey.current = '';
      await loadData();
    } catch {
      setError(failure);
    } finally {
      setSaving(false);
    }
  };

  const startReceiving = (order: PurchaseOrder) => {
    updateReceiveForm({
      order,
      lines: order.lines.flatMap((line) => {
        const quantityReceived = outstandingQuantity(line);
        return quantityReceived > 0
          ? [
              {
                purchaseOrderLineId: line.id,
                quantityReceived,
                batchNumber: '',
                lotNumber: '',
                expiryDate: '',
              },
            ]
          : [];
      }),
    });
    receiptIdempotencyKey.current = crypto.randomUUID();
  };

  const submitReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!receivingOrder) return;
    const lines = receiptLines.flatMap((line) => {
      if (line.quantityReceived <= 0) return [];
      return [
        {
          purchaseOrderLineId: line.purchaseOrderLineId,
          quantityReceived: line.quantityReceived,
          ...(line.batchNumber.trim() ? { batchNumber: line.batchNumber.trim() } : {}),
          ...(line.lotNumber.trim() ? { lotNumber: line.lotNumber.trim() } : {}),
          ...(line.expiryDate
            ? { expiryDate: new Date(`${line.expiryDate}T00:00:00.000Z`).toISOString() }
            : {}),
        },
      ];
    });
    if (!lines.length) {
      setError('Enter a quantity for at least one item.');
      return;
    }
    await runOrderAction(
      () =>
        receivePurchaseOrderDelivery(receivingOrder.id, {
          idempotencyKey: receiptIdempotencyKey.current,
          lines,
        }),
      'The delivery could not be recorded. Please try again.'
    );
  };

  if (loading)
    return (
      <div className="px-6 py-8" aria-label="Loading purchase orders">
        <div className="h-36 animate-pulse rounded-2xl bg-card-hover" />
      </div>
    );

  return (
    <PermissionGate allOf={[PERMISSIONS.INVENTORY_VIEW_ANY]} fallback={<Fallback />}>
      <main className="yc-page-content min-h-full space-y-5 px-4 py-5 sm:px-6 print:hidden">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              text="Back to inventory"
              href="/inventory"
              variant="secondary"
              className="mt-0.5"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                Stock / Purchasing
              </p>
              <h1 className="text-page-title mt-1">Purchase orders</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Order stock, confirm supplier commitments, and track each delivery.
              </p>
            </div>
          </div>
          {canEdit && (
            <Button
              text={showCreateForm ? 'Close form' : 'New order'}
              variant="primary"
              onClick={() => updateCreateForm((current) => ({ show: !current.show }))}
            />
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]"
          >
            <p>{error}</p>
            {loadFailed && (
              <Button text="Retry loading" variant="secondary" onClick={() => void loadData()} />
            )}
          </div>
        )}

        <section aria-label="Purchasing summary" className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Orders
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{totalOrderCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Units outstanding
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{outstandingUnits}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Open value on this page
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-lg font-semibold text-text-primary">
              {Object.entries(committedSpend).length ? (
                Object.entries(committedSpend).map(([unit, amount]) => (
                  <span key={unit}>{formatMoney(amount, unit)}</span>
                ))
              ) : (
                <span>—</span>
              )}
            </div>
          </Card>
        </section>

        {showCreateForm && canEdit && (
          <PurchaseOrderForm
            form={createForm}
            vendors={vendors}
            items={items}
            itemById={itemById}
            saving={saving}
            onFormChange={updateCreateForm}
            onSubmit={submitOrder}
          />
        )}

        <OrderHistory
          orders={orders}
          page={page}
          totalOrderCount={totalOrderCount}
          totalPages={totalPages}
          loading={loading}
          canEdit={canEdit}
          vendorById={vendorById}
          onCreate={() => updateCreateForm({ show: true })}
          onPageChange={(nextPage) => updateData({ page: nextPage })}
          onPrint={setPrintOrder}
          onReview={(order) => {
            setError(null);
            setReviewingOrder(order);
          }}
          onReceive={startReceiving}
          onCancel={(order) =>
            void runOrderAction(
              () => cancelPurchaseOrder(order.id),
              'The order could not be cancelled.'
            )
          }
        />
      </main>

      <ReviewOrderDialog
        order={reviewingOrder}
        canEdit={canEdit}
        saving={saving}
        error={error}
        vendorById={vendorById}
        itemById={itemById}
        onClose={() => setReviewingOrder(null)}
        onConfirm={(order) =>
          void runOrderAction(
            () => confirmPurchaseOrder(order.id),
            'The order could not be confirmed.'
          )
        }
      />
      <ReceiveOrderDialog
        order={receivingOrder}
        lines={receiptLines}
        itemById={itemById}
        saving={saving}
        onClose={closeReceiving}
        onChange={updateReceiveForm}
        onSubmit={submitReceipt}
      />
      <PurchaseOrderPrintView order={printOrder} vendorById={vendorById} itemById={itemById} />
    </PermissionGate>
  );
};

export default PurchaseOrdersContent;
