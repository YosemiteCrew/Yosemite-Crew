import type { BatchValues } from '@/app/features/inventory/pages/Inventory/types';

/* The batch editor's state machine, lifted out of InventoryInfo.tsx so the
   editor's hook can own it without importing back into the component that
   renders it. Unchanged otherwise. */
/* The empty batch row and the field names that only apply to a drug batch.
   They belong with the editor's state, and the hook needs them. */
export const drugOnlyBatchFieldNames = new Set(['tracking']);

export const emptyBatch: BatchValues = {
  batch: '',
  manufactureDate: '',
  expiryDate: '',
  serial: '',
  tracking: '',
  litterId: '',
  nextRefillDate: '',
  quantity: '',
  allocated: '',
};

export type BatchEditorState = {
  newBatches: BatchValues[];
  isEditing: boolean;
  editableExistingBatches: BatchValues[];
};

export const initialBatchEditorState: BatchEditorState = {
  newBatches: [],
  isEditing: false,
  editableExistingBatches: [],
};

export type BatchEditorAction =
  { type: 'PATCH'; payload: Partial<BatchEditorState> } | { type: 'RESET' };

export const batchEditorReducer = (
  state: BatchEditorState,
  action: BatchEditorAction
): BatchEditorState => {
  switch (action.type) {
    case 'PATCH': {
      const next = { ...state, ...action.payload };
      // Bail out with the same reference when nothing actually changed, so a
      // no-op PATCH doesn't force a re-render the way useState's Object.is
      // bailout would already prevent for an individual setter.
      const keys = Object.keys(action.payload) as (keyof BatchEditorState)[];
      const changed = keys.some((key) => next[key] !== state[key]);
      return changed ? next : state;
    }
    case 'RESET':
      return state === initialBatchEditorState ? state : initialBatchEditorState;
    /* v8 ignore next 2 -- unreachable: dispatchBatchEditor is only ever called with PATCH or RESET actions, so this defensive default never runs */
    default:
      return state;
  }
};
