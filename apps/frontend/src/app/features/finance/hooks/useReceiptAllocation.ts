'use client';
import { useMemo, useRef, useState } from 'react';
import type { Invoice } from '@yosemite-crew/types';
import {
  ProviderReceiptAllocationError,
  allocateProviderReceipt,
} from '@/app/features/finance/services/providerReceiptService';
import type {
  ProviderReceipt,
  ProviderReceiptAllocationResult,
} from '@/app/features/finance/types/providerReceipt';
import { allocatableInvoices } from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';
import {
  reviewAllocationDraft,
  suggestedAmount,
  type AllocationDraft,
  type AllocationReview,
} from '@/app/features/finance/pages/PaymentReconciliation/allocationDraft';

const SUBMIT_FALLBACK = 'Unable to apply this captured payment.';

export type AllocationFailure = { code: string; message: string };

export type ReceiptAllocation = {
  /** The invoices this capture may be applied to, already narrowed. */
  options: ReturnType<typeof allocatableInvoices>;
  /** Every figure the operator is shown before they commit money. */
  review: AllocationReview;
  draft: AllocationDraft;
  failure: AllocationFailure | null;
  /** The stored result of a successful write, or null while none has happened. */
  result: ProviderReceiptAllocationResult | null;
  toggle: (invoiceId: string) => void;
  setAmount: (invoiceId: string, value: string) => void;
  submit: () => Promise<void>;
};

export type ReceiptAllocationInput = {
  receipt: ProviderReceipt;
  organisationId: string;
  invoices: readonly Invoice[];
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  onAllocated: (receipt: ProviderReceipt) => void;
};

/**
 * One operator's in-progress decision to apply a captured payment.
 *
 * Held apart from the dialog so the state machine can be driven directly -
 * seeding a line, retiring the idempotency key, reading a refusal back - rather
 * than only through a render that also has to be correct.
 *
 * `submitting` is owned by the caller, not here, because dismissal is refused
 * while a request is in flight and Escape reaches the dialog shell rather than
 * the form. A flag held in this hook could disable its own buttons and still
 * let the panel be closed out from under a request already sent.
 */
export const useReceiptAllocation = ({
  receipt,
  organisationId,
  invoices,
  submitting,
  setSubmitting,
  onAllocated,
}: ReceiptAllocationInput): ReceiptAllocation => {
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<AllocationDraft>({});
  const [failure, setFailure] = useState<AllocationFailure | null>(null);
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
          : { code: '', message: SUBMIT_FALLBACK };
      setFailure({ code: detail.code, message: detail.message });
    } finally {
      setSubmitting(false);
    }
  };

  return { options, review, draft, failure, result, toggle, setAmount, submit };
};
