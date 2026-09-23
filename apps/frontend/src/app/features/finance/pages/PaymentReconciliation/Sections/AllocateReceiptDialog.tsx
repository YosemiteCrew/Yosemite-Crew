'use client';
import React, { useState } from 'react';
import type { Invoice } from '@yosemite-crew/types';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { formatMoneyPrecise } from '@/app/lib/money';
import { useReceiptAllocation } from '@/app/features/finance/hooks/useReceiptAllocation';
import type {
  ProviderReceipt,
  ProviderReceiptAllocationResult,
} from '@/app/features/finance/types/providerReceipt';
import {
  allocationBlockedReason,
  formatCapturedAt,
  truncateReference,
} from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';
import AllocationPicker, {
  errorTextClass,
} from '@/app/features/finance/pages/PaymentReconciliation/Sections/AllocationPicker';

const TITLE_ID = 'allocate-receipt-title';

const panelClass = 'flex flex-col gap-4 px-3 pb-3';

/**
 * The refusal that means the row the decision was taken from has moved.
 *
 * Singled out because it is the only failure with an action other than
 * "correct the form": the operator has to see the capture as it now stands
 * before deciding again, and a retry from this dialog would re-submit a
 * decision taken from a state that no longer exists.
 */
const VERSION_CONFLICT = 'VERSION_CONFLICT';

type AllocateReceiptDialogProps = {
  /** The capture being applied. Null closes the dialog. */
  receipt: ProviderReceipt | null;
  organisationId: string;
  /** Every invoice loaded for this organisation; narrowed here to the eligible ones. */
  invoices: readonly Invoice[];
  /** The invoice store has not answered yet. Distinct from "no eligible invoices". */
  invoicesLoading: boolean;
  onClose: () => void;
  /** The stored receipt, for the row it came from. Called with the readback. */
  onAllocated: (receipt: ProviderReceipt) => void;
  /** Start the queue again, after a stale read. */
  onRequestReload: () => void;
};

type DialogBodyProps = Omit<AllocateReceiptDialogProps, 'receipt'> & {
  receipt: ProviderReceipt;
  /** Held by the dialog shell, which also has to refuse dismissal while it is set. */
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
};

const ReadBack = ({
  result,
  currency,
  onClose,
}: Readonly<{
  result: ProviderReceiptAllocationResult;
  currency: string;
  onClose: () => void;
}>) => (
  <div className="flex flex-col gap-3 px-3 pb-3">
    {/*
      The figures come from the response, never from the form. A summary
      rendered from what was asked for reads identically whether the server
      applied it in full, applied less because an invoice was part-paid in the
      meantime, or replayed an earlier attempt.
    */}
    {/*
      `<output>` rather than a paragraph carrying `role="status"`. It is the
      element for a value the page computed in response to what the user did,
      it carries the same implicit role, and Sonar's S6819 is about the
      platforms where the explicit role is not announced.
    */}
    <output className="block text-body-4 text-text-primary">
      {result.replayed
        ? 'This payment had already been applied. Nothing was posted twice.'
        : 'Payment applied.'}
    </output>
    <ul className="flex flex-col gap-1 list-none pl-0!">
      {result.allocations.map((line) => (
        <li key={line.invoiceId} className="text-body-4 text-text-secondary">
          {`${formatMoneyPrecise(line.amount, currency)} applied`}
        </li>
      ))}
    </ul>
    <p className="text-body-4 text-text-secondary">
      {`${formatMoneyPrecise(result.remainingAmount, currency)} of this capture is still unapplied.`}
    </p>
    <div className="flex justify-end">
      <Primary text="Done" onClick={onClose} ariaLabel="Close the applied payment summary" />
    </div>
  </div>
);

/** A capture the route would refuse, refused here instead of offered a form. */
const Blocked = ({ reason, onClose }: Readonly<{ reason: string; onClose: () => void }>) => (
  <div className="flex flex-col gap-3 px-3 pb-3">
    <p role="alert" className="text-body-4 text-text-secondary">
      {reason}
    </p>
    <div className="flex justify-end">
      <Secondary text="Close" onClick={onClose} ariaLabel="Close" />
    </div>
  </div>
);

/**
 * What the server said, and the one refusal that has an action of its own.
 *
 * Every other code is something the operator corrects in the form in front of
 * them, so the sentence is the whole response.
 */
const SubmitFailure = ({
  failure,
  onRequestReload,
}: Readonly<{
  failure: { code: string; message: string };
  onRequestReload: () => void;
}>) => (
  <div className="flex flex-col gap-2 rounded-2xl bg-danger-100 p-3!">
    <p role="alert" className="text-body-4 text-text-error">
      {failure.message}
    </p>
    {failure.code === VERSION_CONFLICT && (
      <Secondary
        text="Reload the queue"
        size="compact"
        onClick={onRequestReload}
        ariaLabel="Reload the reconciliation queue and start again"
      />
    )}
  </div>
);

const DialogBody = ({
  receipt,
  organisationId,
  invoices,
  invoicesLoading,
  onClose,
  onAllocated,
  onRequestReload,
  submitting,
  setSubmitting,
}: Readonly<DialogBodyProps>) => {
  const { options, review, draft, failure, result, toggle, setAmount, submit } =
    useReceiptAllocation({
      receipt,
      organisationId,
      invoices,
      submitting,
      setSubmitting,
      onAllocated,
    });

  if (result) {
    return <ReadBack result={result} currency={receipt.currency} onClose={onClose} />;
  }

  const blocked = allocationBlockedReason(receipt);
  if (blocked) return <Blocked reason={blocked} onClose={onClose} />;

  return (
    <div className={panelClass}>
      <p className="text-body-4 text-text-secondary">
        {`${formatMoneyPrecise(review.residual, receipt.currency)} of this capture is unapplied. ` +
          'Choose the invoices it belongs to.'}
      </p>

      <AllocationPicker
        options={options}
        lines={review.lines}
        amounts={draft}
        loading={invoicesLoading}
        disabled={submitting}
        currency={receipt.currency}
        onToggle={toggle}
        onAmountChange={setAmount}
      />

      <p className="text-body-4 text-text-primary" aria-live="polite">
        {`${formatMoneyPrecise(review.total, receipt.currency)} selected. ` +
          `${formatMoneyPrecise(review.residualAfter, receipt.currency)} would remain unapplied.`}
      </p>

      {review.formError !== null && options.length > 0 && (
        <p role="alert" className={errorTextClass}>
          {review.formError}
        </p>
      )}

      {failure && <SubmitFailure failure={failure} onRequestReload={onRequestReload} />}

      <div className="flex flex-wrap justify-end gap-3">
        <Secondary text="Cancel" onClick={onClose} isDisabled={submitting} ariaLabel="Cancel" />
        <Primary
          text={submitting ? 'Applying...' : 'Apply payment'}
          onClick={submit}
          isDisabled={!review.canSubmit || submitting}
          ariaLabel="Apply this captured payment to the selected invoices"
        />
      </div>
    </div>
  );
};

/**
 * Applying a captured payment to invoices (#3170 delivery 2, from the screen).
 *
 * The endpoint for this has existed since #3415 and nothing in the product
 * called it, so an operator could see an unapplied capture in the queue and
 * still needed an API client to do anything about it. This is that action.
 *
 * The dialog is keyed on the receipt id, so choosing a different capture
 * mounts a fresh one: an amount typed against one capture must never survive
 * into a form that will post it against another.
 */
const AllocateReceiptDialog = ({ receipt, ...rest }: Readonly<AllocateReceiptDialogProps>) => {
  const open = receipt !== null;

  /*
   * The in-flight flag lives here rather than in the body because dismissal
   * does too. Escape and a backdrop click reach the shell, not the form, so a
   * guard held inside the body could disable its own Cancel button and still
   * let the dialog be dismissed out from under a request that has already been
   * sent - leaving the operator with no answer about money that may have moved.
   */
  const [submitting, setSubmitting] = useState(false);

  const requestClose = () => {
    if (!submitting) rest.onClose();
  };

  /*
   * `ModalBase` only ever calls this to dismiss - Escape, a backdrop click and
   * the close button all route through its `closeModal`. Written as a function
   * that closes rather than one that reads its argument, because a branch on a
   * value nothing produces is a branch no test can honestly cover.
   */
  const setShowModal: React.Dispatch<React.SetStateAction<boolean>> = () => requestClose();

  return (
    <CenterModal showModal={open} setShowModal={setShowModal} ariaLabelledBy={TITLE_ID}>
      {receipt !== null && (
        <>
          <ModalHeader
            title="Apply captured payment"
            titleId={TITLE_ID}
            onClose={requestClose}
            isCloseDisabled={submitting}
            meta={`${formatCapturedAt(receipt.capturedAt)} · ${truncateReference(receipt.paymentRef)}`}
          />
          <DialogBody
            key={receipt.id}
            receipt={receipt}
            {...rest}
            onClose={requestClose}
            submitting={submitting}
            setSubmitting={setSubmitting}
          />
        </>
      )}
    </CenterModal>
  );
};

export default AllocateReceiptDialog;
