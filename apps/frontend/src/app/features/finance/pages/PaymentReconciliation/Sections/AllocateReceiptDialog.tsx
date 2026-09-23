'use client';
import React, { useMemo, useRef, useState } from 'react';
import type { Invoice } from '@yosemite-crew/types';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { formatMoneyPrecise } from '@/app/lib/money';
import {
  ProviderReceiptAllocationError,
  allocateProviderReceipt,
} from '@/app/features/finance/services/providerReceiptService';
import type {
  ProviderReceipt,
  ProviderReceiptAllocationResult,
} from '@/app/features/finance/types/providerReceipt';
import {
  allocatableInvoices,
  allocationBlockedReason,
  formatCapturedAt,
  truncateReference,
} from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';
import {
  reviewAllocationDraft,
  suggestedAmount,
  type AllocationDraft,
} from '@/app/features/finance/pages/PaymentReconciliation/allocationDraft';

const TITLE_ID = 'allocate-receipt-title';

const fieldClass =
  'w-28 rounded-2xl border border-input-border-default focus-within:border-input-border-active ' +
  'bg-transparent px-3 py-2 text-body-4 text-text-primary outline-none tabular-nums';

const errorTextClass = 'text-caption-2 text-text-error';

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
    <p role="status" className="text-body-4 text-text-primary">
      {result.replayed
        ? 'This payment had already been applied. Nothing was posted twice.'
        : 'Payment applied.'}
    </p>
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
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<AllocationDraft>({});
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [result, setResult] = useState<ProviderReceiptAllocationResult | null>(null);

  /*
   * Minted once per decision and deliberately NOT cleared when a submit fails.
   *
   * A failed request is the case the key exists for: a timeout leaves the
   * screen unable to tell a write that never happened from one whose answer
   * was lost, and retrying under the same key is what makes the two safe to
   * confuse. It is cleared when the operator edits the form, because that is a
   * different decision and must not be recognised as a replay of this one.
   */
  const idempotencyKeyRef = useRef<string | null>(null);

  const options = useMemo(() => allocatableInvoices(invoices, receipt), [invoices, receipt]);
  const review = useMemo(
    () => reviewAllocationDraft(receipt, options, selected, draft),
    [receipt, options, selected, draft]
  );

  /*
   * Every edit retires the key. The operator changing what they are asking for
   * is a different decision, and submitting it under the previous key would
   * let the server recognise it as a replay of the one they abandoned.
   */
  const beginEdit = () => {
    idempotencyKeyRef.current = null;
    setFailure(null);
  };

  const toggle = (invoiceId: string) => {
    beginEdit();
    const wasSelected = selected.includes(invoiceId);
    setSelected(wasSelected ? selected.filter((id) => id !== invoiceId) : [...selected, invoiceId]);

    if (wasSelected || draft[invoiceId] !== undefined) return;
    const invoice = options.find((option) => option.id === invoiceId);
    if (!invoice) return;
    /*
     * Seeded against what the OTHER selected lines already claim, not against
     * the whole residual - ticking a second invoice on a capture with nothing
     * left should offer nothing, not offer the same money again.
     */
    setDraft({ ...draft, [invoiceId]: suggestedAmount(invoice, review.residual - review.total) });
  };

  const setAmount = (invoiceId: string, value: string) => {
    beginEdit();
    setDraft({ ...draft, [invoiceId]: value });
  };

  const submit = async () => {
    if (!review.canSubmit || submitting) return;
    idempotencyKeyRef.current ??= crypto.randomUUID();

    setSubmitting(true);
    setFailure(null);
    try {
      const allocated = await allocateProviderReceipt(organisationId, receipt.id, {
        expectedVersion: receipt.version,
        idempotencyKey: idempotencyKeyRef.current,
        allocations: review.lines.map((line) => ({
          invoiceId: line.invoice.id,
          amount: line.amount as number,
        })),
      });
      setResult(allocated);
      onAllocated(allocated.receipt);
    } catch (error) {
      const detail =
        error instanceof ProviderReceiptAllocationError
          ? error.failure
          : { code: '', message: 'Unable to apply this captured payment.' };
      setFailure({ code: detail.code, message: detail.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return <ReadBack result={result} currency={receipt.currency} onClose={onClose} />;
  }

  const blocked = allocationBlockedReason(receipt);
  if (blocked) {
    return (
      <div className="flex flex-col gap-3 px-3 pb-3">
        <p role="alert" className="text-body-4 text-text-secondary">
          {blocked}
        </p>
        <div className="flex justify-end">
          <Secondary text="Close" onClick={onClose} ariaLabel="Close" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-3 pb-3">
      <p className="text-body-4 text-text-secondary">
        {`${formatMoneyPrecise(review.residual, receipt.currency)} of this capture is unapplied. ` +
          'Choose the invoices it belongs to.'}
      </p>

      {invoicesLoading && (
        <p className="text-body-4 text-text-secondary" aria-live="polite">
          {'Loading invoices...'}
        </p>
      )}

      {!invoicesLoading && options.length === 0 && (
        <p className="text-body-4 text-text-secondary">
          {`No open invoice in ${receipt.currency} has an outstanding balance, so there is nothing to apply this capture to yet.`}
        </p>
      )}

      {options.length > 0 && (
        <fieldset className="flex flex-col gap-2 border-0 p-0! m-0!">
          <legend className="text-caption-2 font-bold text-text-tertiary">
            {'Invoices this payment can be applied to'}
          </legend>
          {options.map((invoice) => {
            const line = review.lines.find((entry) => entry.invoice.id === invoice.id);
            const amountId = `allocate-amount-${invoice.id}`;
            const errorId = `${amountId}-error`;
            return (
              <div key={invoice.id} className="flex flex-wrap items-center gap-3">
                <label className="flex flex-1 min-w-0 items-center gap-2 text-body-4 text-text-primary">
                  <input
                    type="checkbox"
                    checked={line !== undefined}
                    onChange={() => toggle(invoice.id)}
                    disabled={submitting}
                  />
                  <span className="truncate">{invoice.label}</span>
                  <span className="text-caption-2 text-text-secondary whitespace-nowrap">
                    {`${formatMoneyPrecise(invoice.balance, invoice.currency)} owed`}
                  </span>
                </label>
                {line !== undefined && (
                  <span className="flex flex-col gap-1">
                    <label htmlFor={amountId} className="sr-only">
                      {`Amount to apply to ${invoice.label}`}
                    </label>
                    <input
                      id={amountId}
                      type="text"
                      inputMode="decimal"
                      value={draft[invoice.id] ?? ''}
                      onChange={(e) => setAmount(invoice.id, e.target.value)}
                      disabled={submitting}
                      aria-invalid={line.error !== null}
                      aria-describedby={line.error === null ? undefined : errorId}
                      className={fieldClass}
                    />
                    {line.error !== null && (
                      <span id={errorId} role="alert" className={errorTextClass}>
                        {line.error}
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </fieldset>
      )}

      <p className="text-body-4 text-text-primary" aria-live="polite">
        {`${formatMoneyPrecise(review.total, receipt.currency)} selected. ` +
          `${formatMoneyPrecise(review.residualAfter, receipt.currency)} would remain unapplied.`}
      </p>

      {review.formError !== null && options.length > 0 && (
        <p role="alert" className={errorTextClass}>
          {review.formError}
        </p>
      )}

      {failure && (
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
      )}

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
