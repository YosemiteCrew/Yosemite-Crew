'use client';
import React from 'react';
import Link from 'next/link';
import { formatMoneyPrecise } from '@/app/lib/money';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import EstimateStatusBadge from '@/app/features/finance/pages/Estimates/Sections/EstimateStatusBadge';
import EstimateLineItems from '@/app/features/finance/pages/Estimates/Sections/EstimateLineItems';
import {
  canApprove,
  canConvert,
  canDecline,
  canSend,
  type Estimate,
} from '@/app/features/finance/types/estimate';

export type EstimateAction = 'send' | 'approve' | 'decline' | 'convert';

type EstimateDetailProps = {
  estimate: Estimate;
  companionName: string;
  /** Which action is in flight, so only that button shows a pending label. */
  pendingAction: EstimateAction | null;
  onAction: (action: EstimateAction) => void;
  error: string | null;
};

const summaryRow = (label: string, value: string, emphasis = false) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-body-4 text-text-secondary">{label}</span>
    <span className={emphasis ? 'text-body-2 text-text-primary' : 'text-body-3 text-text-primary'}>
      {value}
    </span>
  </div>
);

/**
 * One estimate: its lines, its totals, and the lifecycle actions the backend
 * will currently accept.
 *
 * Actions are gated twice - by `billing:edit:any` so a read-only user never sees
 * them, and by the status predicates so the UI never offers a transition the
 * service would reject with a 409.
 */
const EstimateDetail = ({
  estimate,
  companionName,
  pendingAction,
  onAction,
  error,
}: EstimateDetailProps) => {
  const busy = pendingAction !== null;
  const label = (action: EstimateAction, idle: string, pending: string) =>
    pendingAction === action ? pending : idle;

  return (
    <div className="border border-card-border rounded-2xl flex flex-col">
      <div className="px-6! py-4! border-b border-b-card-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-heading-4 text-text-primary">{companionName}</h2>
          <EstimateStatusBadge status={estimate.status} />
        </div>
        {estimate.convertedToInvoiceId ? (
          <Link
            href={`/finance?invoiceId=${estimate.convertedToInvoiceId}`}
            className="text-body-4 text-blue-text underline underline-offset-2"
          >
            View the invoice
          </Link>
        ) : null}
      </div>

      <div className="px-6! py-4! flex flex-col gap-4">
        {estimate.status === 'CONVERTED' && (
          <p className="text-body-4 text-text-secondary rounded-2xl bg-card-hover p-3!">
            This estimate has been converted to an invoice. Converting again would not create a
            second one.
          </p>
        )}

        <EstimateLineItems estimate={estimate} />

        <div
          className="flex flex-col gap-2 border-t border-t-card-border pt-4!"
          role="group"
          aria-label="Estimate totals"
        >
          {summaryRow('Subtotal', formatMoneyPrecise(estimate.subtotal, estimate.currency))}
          {summaryRow('Tax', formatMoneyPrecise(estimate.taxAmount, estimate.currency))}
          {summaryRow('Total', formatMoneyPrecise(estimate.total, estimate.currency), true)}
        </div>

        {estimate.notes ? (
          <p className="text-body-4 text-text-secondary whitespace-pre-line">{estimate.notes}</p>
        ) : null}

        {estimate.declineReason ? (
          <p className="text-body-4 text-text-secondary">Declined: {estimate.declineReason}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-body-4 text-text-error">
            {error}
          </p>
        ) : null}

        <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2!">
            {canSend(estimate.status) && (
              <Secondary
                text={label('send', 'Mark as sent', 'Sending...')}
                isDisabled={busy}
                onClick={() => onAction('send')}
                ariaLabel="Mark this estimate as sent"
              />
            )}
            {canDecline(estimate.status) && (
              <Secondary
                text={label('decline', 'Decline', 'Declining...')}
                isDisabled={busy}
                onClick={() => onAction('decline')}
                ariaLabel="Decline this estimate"
              />
            )}
            {canApprove(estimate.status) && (
              <Secondary
                text={label('approve', 'Approve', 'Approving...')}
                isDisabled={busy}
                onClick={() => onAction('approve')}
                ariaLabel="Approve this estimate"
              />
            )}
            {canConvert(estimate.status) && (
              <Primary
                text={label('convert', 'Convert to invoice', 'Converting...')}
                isDisabled={busy}
                onClick={() => onAction('convert')}
                ariaLabel="Convert this estimate to an invoice"
              />
            )}
          </div>
        </PermissionGate>
      </div>
    </div>
  );
};

export default EstimateDetail;
