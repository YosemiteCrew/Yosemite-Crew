'use client';

import { useState } from 'react';
import { BatchValues } from '@/app/features/inventory/pages/Inventory/types';
import Input, { Textarea } from '@/app/ui/Input';
import Text from '@/app/ui/Text';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  InventoryCount,
  reconcileInventoryCount,
  recordInventoryBatchCount,
} from '@/app/features/inventory/services/inventoryCountService';

type InventoryBatchCountProps = {
  organisationId?: string;
  itemId?: string;
  itemName: string;
  batches: BatchValues[];
  disabled?: boolean;
  onRefresh?: () => Promise<unknown> | unknown;
};

const getBatchLabel = (batch: BatchValues, index: number) =>
  batch.batch || batch.serial || `Batch ${index + 1}`;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The count could not be saved. Try again.';

const InventoryBatchCount = ({
  organisationId,
  itemId,
  itemName,
  batches,
  disabled = false,
  onRefresh,
}: InventoryBatchCountProps) => {
  const countableBatches = batches.filter((batch) => Boolean(batch._id));
  const [isOpen, setIsOpen] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [physicalCount, setPhysicalCount] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [pendingCount, setPendingCount] = useState<InventoryCount | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedBatch = countableBatches.find((batch) => batch._id === selectedBatchId);
  const canSubmit = Boolean(
    organisationId &&
    itemId &&
    selectedBatch &&
    physicalCount !== '' &&
    Number.isInteger(Number(physicalCount)) &&
    Number(physicalCount) >= 0
  );

  const handleScanChange = (value: string) => {
    setScanValue(value);
    const match = countableBatches.find(
      (batch) => batch.barcode === value || batch.batch === value || batch.serial === value
    );
    setSelectedBatchId(match?._id ?? '');
  };

  const resetCount = () => {
    setScanValue('');
    setSelectedBatchId('');
    setPhysicalCount('');
    setCountNotes('');
    setResolutionNotes('');
    setPendingCount(null);
    setMessage('');
    setError('');
  };

  const handleRecord = async () => {
    if (!canSubmit || !organisationId || !itemId || !selectedBatch) return;
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const count = await recordInventoryBatchCount(organisationId, {
        inventoryItemId: itemId,
        inventoryBatchId: selectedBatch._id!,
        countedAt: new Date().toISOString(),
        physicalCount: Number(physicalCount),
        ...(countNotes.trim() ? { notes: countNotes.trim() } : {}),
      });
      if (count.discrepancy === 0) {
        setMessage('Count recorded. Stock already matches.');
        await onRefresh?.();
      } else {
        setPendingCount(count);
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolve = async (resolution: 'STOCK_ADJUSTED' | 'NO_CHANGE') => {
    if (!organisationId || !pendingCount) return;
    if (resolution === 'NO_CHANGE' && !resolutionNotes.trim()) {
      setError('Add a reason before leaving stock unchanged.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await reconcileInventoryCount(organisationId, pendingCount.id, {
        resolution,
        ...(resolutionNotes.trim() ? { resolutionNotes: resolutionNotes.trim() } : {}),
      });
      setPendingCount(null);
      setMessage(
        resolution === 'STOCK_ADJUSTED'
          ? 'Stock updated to the counted quantity.'
          : 'Count recorded without changing stock.'
      );
      await onRefresh?.();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  if (countableBatches.length === 0) return null;

  return (
    <section className="mt-5 rounded-2xl border border-card-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Text as="h3" variant="body-3-emphasis" className="text-text-primary">
            Batch stock count
          </Text>
          <Text variant="caption-1" className="text-text-secondary">
            Count a batch and review any difference before changing stock.
          </Text>
        </div>
        {!isOpen && (
          <Secondary
            href="#"
            text="Start count"
            onClick={() => setIsOpen(true)}
            isDisabled={disabled}
          />
        )}
      </div>

      {isOpen && (
        <div className="mt-4 flex flex-col gap-4">
          {!pendingCount && !message && (
            <>
              <label className="flex flex-col gap-1.5">
                <Text as="span" variant="caption-1" className="text-text-secondary">
                  Scan barcode or enter batch number
                </Text>
                <Input
                  placeholder="Scan or enter a batch"
                  value={scanValue}
                  onChange={(event) => handleScanChange(event.target.value)}
                  list="inventory-count-batches"
                  autoComplete="off"
                />
                <datalist id="inventory-count-batches">
                  {countableBatches.map((batch, index) => (
                    <option
                      key={batch._id}
                      value={batch.barcode || batch.batch || batch.serial || ''}
                    >
                      {getBatchLabel(batch, index)}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1.5">
                <Text as="span" variant="caption-1" className="text-text-secondary">
                  Batch
                </Text>
                <select
                  aria-label="Batch"
                  className="h-10 rounded-xl border border-input-border-default bg-screen px-3 text-body-4 text-text-primary focus:border-input-border-active focus:outline-none"
                  value={selectedBatchId}
                  onChange={(event) => setSelectedBatchId(event.target.value)}
                >
                  <option value="">Choose a batch</option>
                  {countableBatches.map((batch, index) => (
                    <option key={batch._id} value={batch._id}>
                      {getBatchLabel(batch, index)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedBatch && (
                <Text variant="caption-1" className="text-text-secondary">
                  System quantity: {selectedBatch.quantity ?? 'Not available'}
                  {selectedBatch.allocated ? ` · ${selectedBatch.allocated} allocated` : ''}
                </Text>
              )}
              <label className="flex flex-col gap-1.5">
                <Text as="span" variant="caption-1" className="text-text-secondary">
                  Counted quantity
                </Text>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter the physical count"
                  value={physicalCount}
                  onChange={(event) => setPhysicalCount(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <Text as="span" variant="caption-1" className="text-text-secondary">
                  Notes (optional)
                </Text>
                <Textarea
                  aria-label="Count notes (optional)"
                  value={countNotes}
                  onChange={(event) => setCountNotes(event.target.value)}
                  placeholder="Add context for this count"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Primary
                  href="#"
                  text={isSaving ? 'Saving…' : 'Record count'}
                  onClick={handleRecord}
                  isDisabled={!canSubmit || isSaving}
                />
                <Secondary
                  href="#"
                  text="Cancel"
                  onClick={() => {
                    resetCount();
                    setIsOpen(false);
                  }}
                  isDisabled={isSaving}
                />
              </div>
            </>
          )}

          {pendingCount && (
            <div className="flex flex-col gap-3 rounded-xl bg-[var(--inset)] p-4">
              <Text as="h4" variant="body-4-emphasis" className="text-text-primary">
                {itemName}: {pendingCount.systemCount} in stock, {pendingCount.physicalCount}{' '}
                counted
              </Text>
              <Text variant="body-4" className="text-text-secondary">
                Difference: {pendingCount.discrepancy > 0 ? '+' : ''}
                {pendingCount.discrepancy}
              </Text>
              <label className="flex flex-col gap-1.5">
                <Text as="span" variant="caption-1" className="text-text-secondary">
                  Reason if stock stays unchanged
                </Text>
                <Textarea
                  aria-label="Reason if stock stays unchanged"
                  value={resolutionNotes}
                  onChange={(event) => setResolutionNotes(event.target.value)}
                  placeholder="Explain why stock should remain unchanged"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Primary
                  href="#"
                  text={isSaving ? 'Saving…' : 'Adjust stock to count'}
                  onClick={() => handleResolve('STOCK_ADJUSTED')}
                  isDisabled={isSaving}
                />
                <Secondary
                  href="#"
                  text="Leave stock unchanged"
                  onClick={() => handleResolve('NO_CHANGE')}
                  isDisabled={isSaving}
                />
              </div>
            </div>
          )}

          {message && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3">
              <Text variant="body-4" className="text-text-primary">
                {message}
              </Text>
              <Secondary href="#" text="Count another batch" onClick={resetCount} />
            </div>
          )}
          {error && (
            <Text role="alert" variant="caption-1" className="text-danger-text">
              {error}
            </Text>
          )}
        </div>
      )}
    </section>
  );
};

export default InventoryBatchCount;
