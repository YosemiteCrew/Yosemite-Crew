'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { formatMoneyPrecise } from '@/app/lib/money';
import { formatDisplayDate } from '@/app/lib/date';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  fieldClass,
  inputClass,
} from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';
import InsuranceClaimStatusBadge from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimStatusBadge';
import {
  canCancel,
  canSubmit,
  claimStatusLabel,
  nextReviewStatuses,
  statusNeedsApprovedAmount,
  statusNeedsPaidAmount,
  type InsuranceClaim,
  type InsuranceClaimStatus,
  type UpdateClaimStatusInput,
} from '@/app/features/finance/types/insuranceClaim';

export type ClaimAction = 'submit' | 'cancel' | 'status';

type InsuranceClaimDetailProps = {
  claim: InsuranceClaim;
  companionName: string;
  /** Which action is in flight, so only that control shows a pending label. */
  pendingAction: ClaimAction | null;
  onSubmit: () => void;
  onCancel: () => void;
  onUpdateStatus: (payload: UpdateClaimStatusInput) => void;
  error: string | null;
};

const summaryRow = (label: string, value: string, emphasis = false) => (
  <div className="flex items-center justify-between gap-4" key={label}>
    <dt className="text-body-4 text-text-secondary">{label}</dt>
    <dd className={emphasis ? 'text-body-2 text-text-primary' : 'text-body-3 text-text-primary'}>
      {value}
    </dd>
  </div>
);

/** A blank or unparseable numeric field reads as NaN so a required check catches it. */
const toAmount = (raw: string): number => Number(raw.trim());

type Validation = { ok: true } | { ok: false; message: string };

/**
 * Client-side echo of the service's `assertClaimAmountsCoherent`, so the user is
 * told what is wrong before the request 400s. The backend still enforces every
 * rule - this only spares a round trip on the obvious misses.
 */
const validateStatusChange = (
  claim: InsuranceClaim,
  status: InsuranceClaimStatus,
  approved: string,
  paid: string
): Validation => {
  if (statusNeedsApprovedAmount(status)) {
    const value = toAmount(approved);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, message: 'Enter the amount the insurer approved.' };
    }
    if (value > claim.submittedAmount) {
      return { ok: false, message: 'Approved amount cannot exceed the submitted amount.' };
    }
    if (status === 'PARTIALLY_APPROVED' && value >= claim.submittedAmount) {
      return {
        ok: false,
        message: 'A partially approved claim must be approved for less than the submitted amount.',
      };
    }
  }
  if (statusNeedsPaidAmount(status)) {
    const value = toAmount(paid);
    const ceiling = claim.approvedAmount ?? claim.submittedAmount;
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, message: 'Enter the amount the insurer paid.' };
    }
    if (value > ceiling) {
      return { ok: false, message: 'Paid amount cannot exceed the approved amount.' };
    }
  }
  return { ok: true };
};

/** The inline "move this claim on" form: a next-status picker and its amounts. */
const StatusChangeForm = ({
  claim,
  busy,
  onUpdateStatus,
}: {
  claim: InsuranceClaim;
  busy: boolean;
  onUpdateStatus: (payload: UpdateClaimStatusInput) => void;
}) => {
  const options = nextReviewStatuses(claim.status);
  const [status, setStatus] = useState<InsuranceClaimStatus>(options[0]);
  const [approved, setApproved] = useState('');
  const [paid, setPaid] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const submit = () => {
    const result = validateStatusChange(claim, status, approved, paid);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setFormError(null);
    onUpdateStatus({
      status,
      ...(statusNeedsApprovedAmount(status) ? { approvedAmount: toAmount(approved) } : {}),
      ...(statusNeedsPaidAmount(status) ? { paidAmount: toAmount(paid) } : {}),
      ...(status === 'REJECTED' && reason.trim() ? { rejectionReason: reason.trim() } : {}),
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-card-border p-4!">
      <div className="flex flex-col gap-1">
        <label htmlFor="claim-next-status" className="text-caption-2 font-bold text-text-tertiary">
          Move claim to
        </label>
        <span className={`${fieldClass} max-w-72`}>
          <select
            id="claim-next-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as InsuranceClaimStatus)}
            className={inputClass}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {claimStatusLabel(option)}
              </option>
            ))}
          </select>
        </span>
      </div>

      {statusNeedsApprovedAmount(status) && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="claim-approved-amount"
            className="text-caption-2 font-bold text-text-tertiary"
          >
            Approved amount
          </label>
          <span className={`${fieldClass} max-w-52`}>
            <input
              id="claim-approved-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={approved}
              onChange={(e) => setApproved(e.target.value)}
              className={inputClass}
            />
          </span>
        </div>
      )}

      {statusNeedsPaidAmount(status) && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="claim-paid-amount"
            className="text-caption-2 font-bold text-text-tertiary"
          >
            Paid amount
          </label>
          <span className={`${fieldClass} max-w-52`}>
            <input
              id="claim-paid-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              className={inputClass}
            />
          </span>
        </div>
      )}

      {status === 'REJECTED' && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="claim-rejection-reason"
            className="text-caption-2 font-bold text-text-tertiary"
          >
            Rejection reason (optional)
          </label>
          <span className={fieldClass}>
            <textarea
              id="claim-rejection-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
          </span>
        </div>
      )}

      {formError ? (
        <p role="alert" className="text-body-4 text-text-error">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Primary
          text={busy ? 'Updating...' : 'Update status'}
          isDisabled={busy}
          onClick={submit}
          ariaLabel="Update this claim's status"
        />
      </div>
    </div>
  );
};

/**
 * One claim: its amounts, its detail, and the lifecycle actions the backend will
 * currently accept.
 *
 * Actions are gated twice - by `billing:edit:any` so a read-only user never sees
 * them, and by the status predicates so the UI never offers a transition the
 * service would reject with a 409.
 */
const InsuranceClaimDetail = ({
  claim,
  companionName,
  pendingAction,
  onSubmit,
  onCancel,
  onUpdateStatus,
  error,
}: InsuranceClaimDetailProps) => {
  // Reset the inline form when the selected claim changes, so a half-typed
  // amount does not carry across to a different claim.
  const [prevClaimId, setPrevClaimId] = useState(claim.id);
  const [formKey, setFormKey] = useState(0);
  if (prevClaimId !== claim.id) {
    setPrevClaimId(claim.id);
    setFormKey((key) => key + 1);
  }

  const busy = pendingAction !== null;
  const reviewOptions = nextReviewStatuses(claim.status);

  return (
    <div className="border border-card-border rounded-2xl flex flex-col">
      <div className="px-6! py-4! border-b border-b-card-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-heading-4 text-text-primary">{companionName}</h2>
          <InsuranceClaimStatusBadge status={claim.status} />
        </div>
        {claim.invoiceId ? (
          <Link
            href={`/finance?invoiceId=${claim.invoiceId}`}
            className="text-body-4 text-blue-text underline underline-offset-2"
          >
            View the invoice
          </Link>
        ) : null}
      </div>

      <div className="px-6! py-4! flex flex-col gap-4">
        <dl className="flex flex-col gap-2" aria-label="Claim details">
          {summaryRow('Insurer', claim.insurerName)}
          {summaryRow('Policy number', claim.policyNumber)}
          {claim.claimNumber ? summaryRow('Claim number', claim.claimNumber) : null}
          {summaryRow('Submitted', formatMoneyPrecise(claim.submittedAmount, claim.currency))}
          {claim.approvedAmount != null
            ? summaryRow('Approved', formatMoneyPrecise(claim.approvedAmount, claim.currency))
            : null}
          {claim.paidAmount != null
            ? summaryRow('Paid', formatMoneyPrecise(claim.paidAmount, claim.currency), true)
            : null}
          {claim.submittedAt
            ? summaryRow('Submitted on', formatDisplayDate(claim.submittedAt, '-'))
            : null}
          {claim.paidAt ? summaryRow('Paid on', formatDisplayDate(claim.paidAt, '-')) : null}
        </dl>

        {claim.notes ? (
          <p className="text-body-4 text-text-secondary whitespace-pre-line">{claim.notes}</p>
        ) : null}

        {claim.rejectionReason ? (
          <p className="text-body-4 text-text-secondary">Rejected: {claim.rejectionReason}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-body-4 text-text-error">
            {error}
          </p>
        ) : null}

        <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
          <div className="flex flex-col gap-4">
            {reviewOptions.length > 0 && (
              <StatusChangeForm
                key={formKey}
                claim={claim}
                busy={busy}
                onUpdateStatus={onUpdateStatus}
              />
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canSubmit(claim.status) && (
                <Primary
                  text={pendingAction === 'submit' ? 'Submitting...' : 'Submit claim'}
                  isDisabled={busy}
                  onClick={onSubmit}
                  ariaLabel="Submit this claim to the insurer"
                />
              )}
              {canCancel(claim.status) && (
                <Secondary
                  danger
                  text={pendingAction === 'cancel' ? 'Cancelling...' : 'Cancel claim'}
                  isDisabled={busy}
                  onClick={onCancel}
                  ariaLabel="Cancel this claim"
                />
              )}
            </div>
          </div>
        </PermissionGate>
      </div>
    </div>
  );
};

export default InsuranceClaimDetail;
