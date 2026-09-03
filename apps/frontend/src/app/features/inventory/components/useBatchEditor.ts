import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Ref,
} from 'react';

import type { BatchValues, InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { toStringSafe } from '@/app/features/inventory/pages/Inventory/utils';
import type { BusinessType } from '@/app/features/organization/types/org';
import {
  ConfigItem,
  InventoryFormConfig,
} from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import {
  batchEditorReducer,
  drugOnlyBatchFieldNames,
  emptyBatch,
  initialBatchEditorState,
  type BatchEditorState,
} from '@/app/features/inventory/components/batchEditorReducer';

export type BatchEditorHandle = {
  save: () => Promise<void>;
  cancel: () => void;
  startEditing?: () => void;
  isEditing?: () => boolean;
};

export type UseBatchEditorOptions = {
  businessType: BusinessType;
  inventory: InventoryItem;
  disableEditing?: boolean;
  onSave: (values: { newBatches: BatchValues[]; updatedBatches: BatchValues[] }) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
  ref?: Ref<BatchEditorHandle>;
};

/**
 * The batch editor's state machine, its change handlers and the imperative
 * handle the detail panel drives it through — everything except the markup.
 *
 * BatchEditor was 327 lines with about 240 of them logic, which is what React
 * Doctor's `no-giant-component` was pointing at. Nothing here changes
 * behaviour: the block moved out whole and the JSX stayed where it was, so the
 * panel's tests and stories assert exactly what they asserted before.
 */
export const useBatchEditor = ({
  businessType,
  inventory,
  disableEditing,
  onSave,
  onEditingChange,
  ref,
}: UseBatchEditorOptions) => {
  const existingBatches = useMemo<BatchValues[]>(
    () =>
      inventory.batches && inventory.batches.length > 0 ? inventory.batches : [inventory.batch],
    [inventory]
  );
  const [{ newBatches, isEditing, editableExistingBatches }, dispatchBatchEditor] = useReducer(
    batchEditorReducer,
    initialBatchEditorState
  );
  const patchBatchEditor = useCallback(
    (payload: Partial<BatchEditorState>) => dispatchBatchEditor({ type: 'PATCH', payload }),
    []
  );
  const [prevDisableEditing, setPrevDisableEditing] = useState(disableEditing);
  const disableEditingChanged = disableEditing !== prevDisableEditing;
  if (disableEditingChanged) {
    setPrevDisableEditing(disableEditing);
    if (disableEditing && isEditing) {
      patchBatchEditor({ isEditing: false });
    }
  }

  // Mirror EVERY isEditing transition to the parent, from a layout effect that
  // runs after the render commits (calling the parent's setter mid-render would
  // update a different component while this one renders).
  //
  // Watching `disableEditing` changing instead could never report the
  // force-close: the render that sees the change still observes isEditing ===
  // true, and by the render where isEditing is false the change has already
  // been reconciled - so the parent stayed stuck in "section is editing" after
  // the editor had exited. Tracking the transition itself has no such gap.
  const prevIsEditingRef = useRef(isEditing);
  useLayoutEffect(() => {
    if (prevIsEditingRef.current === isEditing) return;
    prevIsEditingRef.current = isEditing;
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  useLayoutEffect(() => {
    dispatchBatchEditor({ type: 'RESET' });
    onEditingChange?.(false);
  }, [inventory, onEditingChange]);

  const configForBusiness = InventoryFormConfig[businessType] || {};
  const isNonDrug = String(inventory.classification?.itemType ?? '').toLowerCase() === 'non-drug';
  const sectionConfig = useMemo<ConfigItem<any>[]>(
    () =>
      (configForBusiness.batch || []).filter((item) => {
        if (!isNonDrug) return true;
        const names = item.kind === 'row' ? item.fields.map((f: any) => f.name) : [item.field.name];
        return names.every((n: string) => !drugOnlyBatchFieldNames.has(n));
      }),
    [configForBusiness.batch, isNonDrug]
  );

  const beginEditing = useCallback(() => {
    if (disableEditing) return;
    patchBatchEditor({
      isEditing: true,
      editableExistingBatches: editableExistingBatches.length
        ? editableExistingBatches
        : existingBatches.map((b) => ({ ...b })),
      newBatches: newBatches.length === 0 ? [{ ...emptyBatch }] : newBatches,
    });
    onEditingChange?.(true);
  }, [
    disableEditing,
    newBatches,
    editableExistingBatches,
    existingBatches,
    patchBatchEditor,
    onEditingChange,
  ]);

  const handleChange = useCallback(
    (index: number, name: keyof BatchValues, value: string) => {
      const next = [...newBatches];
      next[index] = { ...next[index], [name]: value };
      patchBatchEditor({ newBatches: next, isEditing: true });
    },
    [newBatches, patchBatchEditor]
  );

  const handleExistingChange = useCallback(
    (index: number, name: keyof BatchValues, value: string) => {
      let source = editableExistingBatches;
      /* v8 ignore next 3 -- unreachable: beginEditing always seeds editableExistingBatches before an existing batch field can invoke this handler, so the fallback never runs */
      if (editableExistingBatches.length === 0) {
        source = existingBatches.map((b) => ({ ...b }));
      }
      const next = [...source];
      next[index] = { ...next[index], [name]: value };
      patchBatchEditor({ editableExistingBatches: next, isEditing: true });
    },
    [existingBatches, editableExistingBatches, patchBatchEditor]
  );

  const addBatch = useCallback(() => {
    patchBatchEditor({ newBatches: [...newBatches, { ...emptyBatch }], isEditing: true });
  }, [newBatches, patchBatchEditor]);

  const removeBatch = useCallback(
    (index: number) => {
      const next = newBatches.filter((_, i) => i !== index);
      let nextBatches = next;
      /* v8 ignore next 3 -- unreachable: the Remove control only renders while newBatches.length > 1, so filtering one entry out always leaves at least one behind */
      if (next.length === 0) {
        nextBatches = [{ ...emptyBatch }];
      }
      patchBatchEditor({
        newBatches: nextBatches,
        isEditing: true,
      });
    },
    [newBatches, patchBatchEditor]
  );

  const hasBatchChanged = useCallback((original?: BatchValues, updated?: BatchValues) => {
    /* v8 ignore next 3 -- unreachable: handleSave always resolves an original from originalById or existingBatches at the same index, and updated is the batch currently being iterated, so neither is ever missing */
    if (!original || !updated) {
      return false;
    }
    const keys: (keyof BatchValues)[] = [
      'batch',
      'manufactureDate',
      'expiryDate',
      'expiryWarningBefore',
      'barcode',
      'serial',
      'tracking',
      'litterId',
      'nextRefillDate',
      'quantity',
      'allocated',
      'minShelfLifeAlertDate',
    ];
    return keys.some((key) => toStringSafe(original[key]) !== toStringSafe(updated[key]));
  }, []);

  const handleSave = useCallback(async () => {
    const meaningfulNew = newBatches.filter((b) => {
      /* v8 ignore next 3 -- unreachable: every entry pushed into newBatches is an emptyBatch clone, so a nullish batch never reaches here */
      if (!b) {
        return false;
      }
      return Object.values(b).some((v) => toStringSafe(v) !== '');
    });
    let workingExisting = editableExistingBatches;
    /* v8 ignore next 3 -- unreachable: beginEditing seeds editableExistingBatches (and only then reports editing to the parent, which gates the save action), so the snapshot is never empty here */
    if (editableExistingBatches.length === 0) {
      workingExisting = existingBatches;
    }
    const originalById = new Map<string, BatchValues>();
    existingBatches.forEach((b) => {
      if (b?._id) {
        originalById.set(String(b._id), b);
      }
    });
    const updatedBatches = workingExisting.filter((b, idx) => {
      const original = b._id ? originalById.get(String(b._id)) : existingBatches[idx];
      return hasBatchChanged(original, b);
    });

    await onSave({
      newBatches: meaningfulNew,
      updatedBatches,
    });
    dispatchBatchEditor({ type: 'RESET' });
    onEditingChange?.(false);
  }, [
    newBatches,
    editableExistingBatches,
    existingBatches,
    hasBatchChanged,
    onSave,
    onEditingChange,
  ]);

  const handleCancel = useCallback(() => {
    dispatchBatchEditor({ type: 'RESET' });
    onEditingChange?.(false);
  }, [onEditingChange]);

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: handleCancel,
    startEditing: beginEditing,
    isEditing: () => isEditing,
  }));

  return {
    existingBatches,
    newBatches,
    isEditing,
    editableExistingBatches,
    sectionConfig,
    handleChange,
    handleExistingChange,
    addBatch,
    removeBatch,
    beginEditing,
  };
};
