import React, { useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  RECURRENCE_SCOPE_OPTIONS,
  type RecurrenceScope,
} from '@/app/features/tasks/constants/taskTaxonomy';

type RecurrenceScopeModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  /** "Edit" | "Delete" — drives the title and confirm-button label. */
  action: 'edit' | 'delete';
  /** The recurring task's name, shown in the prompt. */
  taskName?: string;
  /** Resolve with the chosen scope; the caller performs the scoped operation. */
  onConfirm: (scope: RecurrenceScope) => void | Promise<void>;
  busy?: boolean;
};

/**
 * Scope chooser for editing/deleting a task that belongs to a recurring series
 * (Google-Calendar style: This task / This and following / All in the series).
 * Reused across the main /tasks module, the Quick Actions panel, and the
 * workspace inpatient schedule so every surface offers the same choice.
 */
const RecurrenceScopeModal: React.FC<RecurrenceScopeModalProps> = ({
  showModal,
  setShowModal,
  action,
  taskName,
  onConfirm,
  busy = false,
}) => {
  // The modal is mounted fresh each time it opens (consumers gate it on open),
  // so the initial 'THIS' already resets the choice — no effect needed.
  const [scope, setScope] = useState<RecurrenceScope>('THIS');

  const isDelete = action === 'delete';
  const title = isDelete ? 'Delete recurring task' : 'Edit recurring task';
  const confirmText = isDelete ? 'Delete' : 'Save changes';

  const handleConfirm = async () => {
    await onConfirm(scope);
  };

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal}>
      <ModalHeader title={title} onClose={() => setShowModal(false)} />
      <div className="flex flex-col gap-4">
        <p className="text-body-4 text-text-primary">
          {taskName
            ? `"${taskName}" is part of a recurring series. `
            : 'This is a recurring task. '}
          Which tasks should this {isDelete ? 'deletion' : 'change'} apply to?
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Apply to</legend>
          {RECURRENCE_SCOPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-body-4 ${
                scope === option.value
                  ? 'border-input-border-active bg-card-hover text-text-primary'
                  : 'border-card-border text-text-secondary'
              }`}
            >
              <input
                type="radio"
                name="recurrence-scope"
                value={option.value}
                checked={scope === option.value}
                onChange={() => setScope(option.value)}
                className="size-4 shrink-0"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <Secondary href="#" text="Cancel" onClick={() => setShowModal(false)} />
          <Primary
            href="#"
            text={busy ? 'Working…' : confirmText}
            onClick={handleConfirm}
            isDisabled={busy}
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default RecurrenceScopeModal;
