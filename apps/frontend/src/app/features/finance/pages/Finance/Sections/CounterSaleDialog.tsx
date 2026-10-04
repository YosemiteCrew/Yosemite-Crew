'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Dropdown from '@/app/ui/inputs/Dropdown/Dropdown';
import { formatMoneyPrecise } from '@/app/lib/money';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import type { InventoryApiItem } from '@/app/features/inventory/pages/Inventory/types';
import {
  createCounterSale,
  finalizeFinanceInvoice,
} from '@/app/features/billing/services/invoiceService';
import type { Invoice } from '@yosemite-crew/types';

type CartLine = { key: number; inventoryItemId: string; quantity: string };

type CounterSaleDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  organisationId: string | null;
  currency: string | undefined;
  onCreated: (invoice: Invoice) => void;
};

const inputClass =
  'w-full rounded-xl border border-card-border bg-card px-3 py-2.5 text-body-3 text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand/50';

const errorMessage = (error: unknown) => {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
  if (error instanceof Error && error.message) return error.message;
  return 'The sale could not be saved. Try again.';
};

const getAvailable = (item: InventoryApiItem) =>
  Math.max(0, (item.onHand ?? 0) - (item.allocated ?? 0));

const isSaleableItem = (item: InventoryApiItem) =>
  item.status === 'ACTIVE' &&
  item.sellingPrice != null &&
  Number.isFinite(item.sellingPrice) &&
  !item.controlledItem &&
  !item.prescriptionRequired &&
  getAvailable(item) > 0;

const isValidSaleLine = (line: CartLine, itemsById: Map<string, InventoryApiItem>) => {
  const item = itemsById.get(line.inventoryItemId);
  const quantity = Number(line.quantity);
  return Boolean(
    item && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= getAvailable(item)
  );
};

const canCreateCounterSale = (
  organisationId: string | null,
  loadingInventory: boolean,
  saving: boolean,
  lines: CartLine[],
  itemsById: Map<string, InventoryApiItem>,
  createdInvoice: Invoice | null
) =>
  Boolean(
    !createdInvoice &&
    organisationId &&
    !loadingInventory &&
    !saving &&
    lines.length > 0 &&
    lines.every((line) => isValidSaleLine(line, itemsById))
  );

const getSavedSaleMessage = (receiptReady: boolean, saving: boolean) => {
  if (receiptReady) return 'Receipt ready. Open the saved invoice.';
  if (saving) return 'Sale saved. Preparing its receipt…';
  return 'Sale saved. Retry receipt generation or open the saved invoice.';
};

const getSubmitLabel = (saving: boolean, createdInvoice: Invoice | null) => {
  if (saving) return 'Saving…';
  if (createdInvoice) return 'Retry receipt';
  return 'Create sale';
};

const getSubmitAriaLabel = (createdInvoice: Invoice | null) => {
  if (createdInvoice) return 'Retry receipt generation';
  return 'Create counter sale';
};

type CounterSaleLineEditorProps = {
  line: CartLine;
  index: number;
  item: InventoryApiItem | undefined;
  items: InventoryApiItem[];
  currency: string | undefined;
  saving: boolean;
  loadingInventory: boolean;
  canRemove: boolean;
  onUpdate: (key: number, patch: Partial<CartLine>) => void;
  onRemove: (key: number) => void;
};

const CounterSaleLineEditor = ({
  line,
  index,
  item,
  items,
  currency,
  saving,
  loadingInventory,
  canRemove,
  onUpdate,
  onRemove,
}: CounterSaleLineEditorProps) => (
  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto]">
    <div className="min-w-0">
      <Dropdown
        placeholder={index === 0 ? 'Item' : `Item ${index + 1}`}
        value={line.inventoryItemId}
        onChange={(inventoryItemId: string) => onUpdate(line.key, { inventoryItemId })}
        options={items.map((option) => ({
          value: option._id,
          label: `${option.name} · ${formatMoneyPrecise(option.sellingPrice ?? 0, option.currency ?? currency)} · ${getAvailable(option)} available`,
        }))}
        search
        disabled={loadingInventory || saving || items.length === 0}
        emptyLabel="Choose an item"
      />
    </div>
    <div>
      <label
        className="mb-1 block text-caption-2 font-bold text-text-tertiary"
        htmlFor={`counter-sale-quantity-${line.key}`}
      >
        Qty
      </label>
      <input
        id={`counter-sale-quantity-${line.key}`}
        className={inputClass}
        type="number"
        min={1}
        max={item ? getAvailable(item) : undefined}
        step={1}
        inputMode="numeric"
        value={line.quantity}
        disabled={saving}
        onChange={(event) => onUpdate(line.key, { quantity: event.target.value })}
      />
    </div>
    <Secondary
      text="Remove"
      size="compact"
      isDisabled={saving || !canRemove}
      onClick={() => onRemove(line.key)}
      ariaLabel={`Remove item ${index + 1}`}
      className="col-span-full justify-self-end sm:col-span-1"
    />
    {item ? (
      <p className="col-span-full -mt-1 text-caption-2 text-text-secondary">
        {formatMoneyPrecise(item.sellingPrice ?? 0, item.currency ?? currency)} each ·{' '}
        {getAvailable(item)} available
      </p>
    ) : null}
  </div>
);

type CounterSaleDialogContentProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currency: string | undefined;
  loadingInventory: boolean;
  inventoryError: string | null;
  onRetryInventory: () => void;
  lines: CartLine[];
  saleableItems: InventoryApiItem[];
  itemsById: Map<string, InventoryApiItem>;
  subtotal: number;
  saving: boolean;
  createdInvoice: Invoice | null;
  receiptReady: boolean;
  error: string | null;
  canSubmit: boolean;
  onUpdateLine: (key: number, patch: Partial<CartLine>) => void;
  onAddLine: () => void;
  onRemoveLine: (key: number) => void;
  onOpenInvoice: () => void;
  onSubmit: () => void;
};

const CounterSaleDialogContent = ({
  open,
  setOpen,
  currency,
  loadingInventory,
  inventoryError,
  onRetryInventory,
  lines,
  saleableItems,
  itemsById,
  subtotal,
  saving,
  createdInvoice,
  receiptReady,
  error,
  canSubmit,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
  onOpenInvoice,
  onSubmit,
}: CounterSaleDialogContentProps) => (
  <CenterModal
    showModal={open}
    setShowModal={setOpen}
    ariaLabel="Create a counter sale"
    containerClassName="sm:w-[min(680px,92vw)]! max-h-[90vh] overflow-y-auto"
  >
    <div className="flex flex-col gap-4 p-6!">
      <div>
        <h2 className="text-heading-4 text-text-primary">Counter sale</h2>
        <p className="mt-1 text-body-4 text-text-secondary">
          Create an invoice and update stock without linking an appointment.
        </p>
      </div>

      {createdInvoice ? (
        <output className="text-body-4 text-text-secondary">
          {getSavedSaleMessage(receiptReady, saving)}
        </output>
      ) : null}
      {!createdInvoice && loadingInventory ? (
        <output className="text-body-4 text-text-secondary">Loading inventory…</output>
      ) : null}
      {!createdInvoice && inventoryError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 text-body-4 text-text-error"
        >
          <span>{inventoryError}</span>
          <Secondary
            text="Retry"
            size="compact"
            onClick={onRetryInventory}
            ariaLabel="Retry loading inventory"
          />
        </div>
      ) : null}
      {!createdInvoice && !loadingInventory && !inventoryError && saleableItems.length === 0 ? (
        <p className="rounded-xl border border-card-border bg-card-hover p-4 text-body-4 text-text-secondary">
          No active, priced items are available for counter sale.
        </p>
      ) : null}

      {!createdInvoice &&
        lines.map((line, index) => (
          <CounterSaleLineEditor
            key={line.key}
            line={line}
            index={index}
            item={itemsById.get(line.inventoryItemId)}
            items={saleableItems}
            currency={currency}
            saving={saving}
            loadingInventory={loadingInventory}
            canRemove={lines.length > 1}
            onUpdate={onUpdateLine}
            onRemove={onRemoveLine}
          />
        ))}

      {!createdInvoice && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border pt-3">
          <Secondary
            text="Add item"
            size="compact"
            isDisabled={saving || saleableItems.length === 0}
            onClick={onAddLine}
          />
          <div className="text-right">
            <p className="text-caption-2 text-text-secondary">Subtotal before tax</p>
            <p className="text-body-2 text-text-primary">
              {formatMoneyPrecise(subtotal, currency)}
            </p>
          </div>
        </div>
      )}
      {!createdInvoice && (
        <p className="text-caption-2 text-text-tertiary">
          The invoice will show the final tax and total.
        </p>
      )}

      {error ? (
        <p role="alert" className="text-body-4 text-text-error">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {createdInvoice ? (
          <Secondary
            text="Open invoice"
            isDisabled={saving}
            onClick={onOpenInvoice}
            ariaLabel="Open saved counter-sale invoice"
          />
        ) : (
          <Secondary
            text="Cancel"
            isDisabled={saving}
            onClick={() => setOpen(false)}
            ariaLabel="Cancel counter sale"
          />
        )}
        {!receiptReady && (
          <Primary
            text={getSubmitLabel(saving, createdInvoice)}
            isDisabled={saving || (!createdInvoice && !canSubmit)}
            onClick={onSubmit}
            ariaLabel={getSubmitAriaLabel(createdInvoice)}
          />
        )}
      </div>
    </div>
  </CenterModal>
);

const CounterSaleDialog = ({
  open,
  setOpen,
  organisationId,
  currency,
  onCreated,
}: CounterSaleDialogProps) => {
  const [inventory, setInventory] = useState<InventoryApiItem[]>([]);
  const [loadedOrganisationId, setLoadedOrganisationId] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([{ key: 0, inventoryItemId: '', quantity: '1' }]);
  const [saving, setSaving] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [receiptReady, setReceiptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextKey = useRef(1);
  const loadingInventory = Boolean(
    open && organisationId && loadedOrganisationId !== organisationId
  );

  useEffect(() => {
    if (!open || !organisationId || loadedOrganisationId === organisationId) return;
    let current = true;
    fetchInventoryItems(organisationId)
      .then((items) => {
        if (current) {
          setInventory(items);
          setInventoryError(null);
          setLoadedOrganisationId(organisationId);
        }
      })
      .catch(() => {
        if (current) {
          setInventoryError('Inventory could not be loaded. Close this dialog and try again.');
          setLoadedOrganisationId(organisationId);
        }
      });
    return () => {
      current = false;
    };
  }, [open, organisationId, loadedOrganisationId]);

  const saleableItems = useMemo(() => inventory.filter(isSaleableItem), [inventory]);
  const itemsById = useMemo(
    () => new Map(saleableItems.map((item) => [item._id, item])),
    [saleableItems]
  );
  const subtotal = lines.reduce((total, line) => {
    const item = itemsById.get(line.inventoryItemId);
    const quantity = Number(line.quantity);
    return item && Number.isSafeInteger(quantity) && quantity > 0
      ? total + (item.sellingPrice ?? 0) * quantity
      : total;
  }, 0);
  const canSubmit = canCreateCounterSale(
    organisationId,
    loadingInventory,
    saving,
    lines,
    itemsById,
    createdInvoice
  );

  const setOpenUnlessSaving: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    if (saving) return;
    setOpen(value);
  };

  const updateLine = (key: number, patch: Partial<CartLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    setError(null);
  };

  const addLine = () => {
    const key = nextKey.current++;
    setLines((current) => [...current, { key, inventoryItemId: '', quantity: '1' }]);
  };

  const removeLine = (key: number) => {
    setLines((current) => current.filter((entry) => entry.key !== key));
  };

  const submit = async () => {
    if (!canSubmit && !createdInvoice) return;
    setSaving(true);
    setError(null);
    let invoice = createdInvoice;
    try {
      if (!invoice && organisationId) {
        invoice = await createCounterSale({
          organisationId,
          items: lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantity: Number(line.quantity),
          })),
        });
        setCreatedInvoice(invoice);
      }
      if (!invoice?.id) throw new Error('The sale was saved without an invoice ID.');
      const finalizedInvoice = await finalizeFinanceInvoice(invoice.id);
      setCreatedInvoice(finalizedInvoice);
      setReceiptReady(true);
      onCreated(finalizedInvoice);
      setOpen(false);
    } catch (requestError) {
      setError(
        invoice
          ? 'The sale was saved, but its receipt could not be prepared. Retry receipt generation or open the saved invoice.'
          : errorMessage(requestError)
      );
    } finally {
      setSaving(false);
    }
  };

  const retryInventory = () => {
    setInventoryError(null);
    setLoadedOrganisationId(null);
  };
  const openInvoice = () => {
    if (!createdInvoice) return;
    onCreated(createdInvoice);
    setOpen(false);
  };

  return (
    <CounterSaleDialogContent
      open={open}
      setOpen={setOpenUnlessSaving}
      currency={currency}
      loadingInventory={loadingInventory}
      inventoryError={inventoryError}
      onRetryInventory={retryInventory}
      lines={lines}
      saleableItems={saleableItems}
      itemsById={itemsById}
      subtotal={subtotal}
      saving={saving}
      createdInvoice={createdInvoice}
      receiptReady={receiptReady}
      error={error}
      canSubmit={canSubmit}
      onUpdateLine={updateLine}
      onAddLine={addLine}
      onRemoveLine={removeLine}
      onOpenInvoice={openInvoice}
      onSubmit={submit}
    />
  );
};

export default CounterSaleDialog;
