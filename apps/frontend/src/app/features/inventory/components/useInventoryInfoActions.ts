import { useLayoutEffect, useRef, useState } from 'react';

import type { BatchValues, InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import type { InventorySectionKey } from '@/app/features/inventory/components/AddInventory/InventoryConfig';

type SectionActions = {
  save: () => Promise<void>;
  cancel: () => void;
  startEditing: () => void;
  isEditing: () => boolean;
};

type BatchActions = {
  save: () => Promise<void>;
  cancel: () => void;
  startEditing?: () => void;
  isEditing?: () => boolean;
};

export type UseInventoryInfoActionsOptions = {
  activeInventory?: InventoryItem | null;
  activeLabel: InventorySectionKey;
  isSectionEditing: boolean;
  setIsSectionEditing: (editing: boolean) => void;
  setShowModal: (open: boolean) => void;
  onUpdate: (item: InventoryItem) => Promise<void> | void;
  onHide: (id: string) => Promise<void> | void;
  onUnhide: (id: string) => Promise<void> | void;
  onAddBatch?: (id: string, batches: BatchValues[]) => Promise<void> | void;
  onUpdateBatch?: (id: string, batches: BatchValues[]) => Promise<void> | void;
  toBatchList: (value: unknown) => BatchValues[];
  /* Passed in rather than imported: the map is declared in InventoryInfo.tsx,
     which imports this hook, so importing it back would be a cycle. */
  sectionValidationHandlers: Partial<
    Record<
      InventorySectionKey,
      (values: Record<string, any>, item: InventoryItem) => Record<string, string>
    >
  >;
};

/**
 * Everything the inventory detail panel DOES, separated from what it draws.
 *
 * The panel had seven pieces of state and six async handlers inline, which is
 * what React Doctor's `no-giant-component` was pointing at: 305 lines in one
 * function, most of them logic rather than markup. Nothing here changes
 * behaviour or the rendered DOM — the handlers moved, the JSX did not — so the
 * panel's tests and stories still assert exactly what they asserted before.
 */
export const useInventoryInfoActions = ({
  activeInventory,
  activeLabel,
  isSectionEditing,
  setIsSectionEditing,
  setShowModal,
  onUpdate,
  onHide,
  onUnhide,
  onAddBatch,
  onUpdateBatch,
  toBatchList,
  sectionValidationHandlers,
}: UseInventoryInfoActionsOptions) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const sectionActions = useRef<SectionActions | null>(null);
  const batchActions = useRef<BatchActions | null>(null);

  // The imperative section/batch handles are cleared after commit whenever the
  // section or item changes, since refs stay off-render. They live here, so the
  // effect that clears them does too.
  useLayoutEffect(() => {
    sectionActions.current = null;
    batchActions.current = null;
  }, [activeLabel, activeInventory?.id]);

  const handleBatchSave = async (values: Record<string, any>) => {
    const newBatches = toBatchList((values as any).newBatches);
    const updatedBatches = toBatchList((values as any).updatedBatches);
    if (!activeInventory?.id) return;
    if (updatedBatches.length && onUpdateBatch) {
      await onUpdateBatch(activeInventory.id, updatedBatches);
    }
    if (newBatches.length && onAddBatch) {
      await onAddBatch(activeInventory.id, newBatches);
    }
  };

  const getValidationErrors = (
    section: InventorySectionKey,
    values: Record<string, any>
  ): Record<string, string> => {
    /* v8 ignore next 3 -- unreachable: handleSectionSave returns early when activeInventory is null, and it is the only caller of this helper */
    if (!activeInventory) {
      return {};
    }
    const handler = sectionValidationHandlers[section];
    return handler ? handler(values, activeInventory) : {};
  };

  const buildUpdatedInventory = (
    section: InventorySectionKey,
    values: Record<string, any>
  ): InventoryItem => ({
    ...activeInventory!,
    [section]: {
      ...(activeInventory as any)[section],
      ...values,
    },
  });

  const saveStandardSection = async (section: InventorySectionKey, values: Record<string, any>) => {
    const errs = getValidationErrors(section, values);
    if (Object.keys(errs).length > 0) {
      console.error(`[Inventory] Validation failed for ${section}`, JSON.stringify(errs));
      return;
    }
    const updated = buildUpdatedInventory(section, values);
    await onUpdate(updated);
  };

  const handleSectionSave = async (section: InventorySectionKey, values: Record<string, any>) => {
    if (!activeInventory || isUpdating || isHiding) return;
    setIsUpdating(true);

    try {
      if (section === 'batch') {
        await handleBatchSave(values);
      } else {
        await saveStandardSection(section, values);
      }
    } catch (err) {
      console.error('Failed to update inventory section:', err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  const setVisibility = async (
    apply: (id: string) => Promise<void> | void,
    failureMessage: string
  ) => {
    /* v8 ignore next 3 -- unreachable: both entry points run from the primary action, which is disabled while isHiding and for an item without an id */
    if (!activeInventory?.id || isHiding) {
      return;
    }
    setIsHiding(true);
    try {
      await apply(activeInventory.id);
      setShowModal(false);
    } catch (err) {
      console.error(failureMessage, err);
    } finally {
      setIsHiding(false);
    }
  };

  const handleHide = () => setVisibility(onHide, 'Failed to hide inventory item:');
  const handleUnhide = () => setVisibility(onUnhide, 'Failed to unhide inventory item:');

  const isHidden = (activeInventory?.status || '').toUpperCase() === 'HIDDEN';
  const isBatchSection = activeLabel === 'batch';

  const handlePrimaryAction = async () => {
    if (isSectionEditing) {
      if (isBatchSection) {
        await batchActions.current?.save?.();
      } else {
        await sectionActions.current?.save?.();
      }
      setIsSectionEditing(false);
      return;
    }
    if (isHidden) {
      await handleUnhide();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleSecondaryAction = async () => {
    if (isSectionEditing) {
      if (isBatchSection) {
        batchActions.current?.cancel?.();
      } else {
        sectionActions.current?.cancel?.();
      }
      setIsSectionEditing(false);
      return;
    }
    setShowModal(false);
  };

  return {
    isUpdating,
    isHiding,
    showDeleteConfirm,
    setShowDeleteConfirm,
    sectionActions,
    batchActions,
    isHidden,
    isBatchSection,
    handleSectionSave,
    handleHide,
    handlePrimaryAction,
    handleSecondaryAction,
  };
};
