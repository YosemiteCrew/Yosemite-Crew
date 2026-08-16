'use client';

import React, { useCallback, useRef, useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';

export type ConfirmOptions = {
  title: string;
  /** One sentence on what happens, written so the consequence is unambiguous. */
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` renders the confirm action in the danger style. */
  tone?: 'default' | 'danger';
};

/**
 * Promise-based confirmation for irreversible actions.
 *
 * The native `confirm()` this replaces is an unstyled, unthemed OS dialog that
 * cannot carry the product's voice, cannot be reviewed in Storybook, and is
 * suppressible by the browser. It is also synchronous, which is why call sites
 * reached for it: they sit inside an async handler and need a yes/no before
 * continuing. `confirm()` here returns a promise, so those handlers keep their
 * shape and only the one line changes.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title, body, tone: 'danger' }))) return;
 *   ...
 *   return (<>{confirmDialog}...</>);
 */
export const useConfirm = () => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  // The resolver lives in a ref rather than state so that settling never
  // depends on a state updater running exactly once.
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions(next);
      }),
    []
  );

  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolve?.(value);
  }, []);

  const confirmDialog = options ? <ConfirmModal options={options} onResolve={settle} /> : null;

  return { confirm, confirmDialog };
};

const ConfirmModal = ({
  options,
  onResolve,
}: Readonly<{ options: ConfirmOptions; onResolve: (value: boolean) => void }>) => {
  const {
    title,
    body,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'default',
  } = options;
  const ConfirmButton = tone === 'danger' ? Delete : Primary;

  return (
    <CenterModal
      showModal
      // Dismissing by backdrop, Escape or the close button is a decline, which
      // matches what the native dialog did.
      setShowModal={() => onResolve(false)}
      onClose={() => onResolve(false)}
      ariaLabel={title}
    >
      <ModalHeader title={title} onClose={() => onResolve(false)} />
      <p className="text-body-4 text-text-primary">{body}</p>
      <ModalFooter>
        <Secondary text={cancelLabel} onClick={() => onResolve(false)} />
        <ConfirmButton text={confirmLabel} onClick={() => onResolve(true)} />
      </ModalFooter>
    </CenterModal>
  );
};

export default ConfirmModal;
