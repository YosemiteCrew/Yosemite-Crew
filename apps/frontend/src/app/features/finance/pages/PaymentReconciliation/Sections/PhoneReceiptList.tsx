'use client';
import React from 'react';
import Link from 'next/link';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { formatMoneyPrecise } from '@/app/lib/money';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';
import {
  allocatableResidual,
  canAllocate,
  formatCapturedAt,
  netCaptured,
  providerLabel,
  statusLabel,
  statusTone,
  truncateReference,
} from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';

const CARD_SHADOW = 'shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]';

const linkClass = 'text-body-4 text-blue-text underline underline-offset-2';

/**
 * One capture as a card.
 *
 * The queue's six columns do not fit a phone: at 390px the table clipped
 * everything after the amount, so the state, the provider reference, the source
 * and the reason - every field an operator needs to decide anything - were off
 * screen with no affordance saying so. Same data, stacked.
 */
const PhoneReceiptCard = ({
  receipt,
  onAllocate,
}: {
  receipt: ProviderReceipt;
  onAllocate?: (receipt: ProviderReceipt) => void;
}) => {
  const { invoiceId, appointmentId } = receipt;

  return (
    <li
      className={`flex flex-col gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-3.5 py-3 ${CARD_SHADOW}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-body-4 text-text-primary">
          {formatCapturedAt(receipt.capturedAt)}
        </span>
        <StatusPill
          label={statusLabel(receipt.status)}
          tone={statusTone(receipt.status)}
          className="shrink-0"
        />
      </span>

      <span className="flex flex-col">
        <span className="text-body-3 text-text-primary">
          {formatMoneyPrecise(receipt.amount, receipt.currency)}
        </span>
        {receipt.refundedAmount > 0 && (
          <span className="text-caption-2 text-text-secondary">
            {`${formatMoneyPrecise(netCaptured(receipt), receipt.currency)} after ${formatMoneyPrecise(
              receipt.refundedAmount,
              receipt.currency
            )} refunded`}
          </span>
        )}
        {receipt.allocatedAmount > 0 && allocatableResidual(receipt) > 0 && (
          <span className="text-caption-2 text-text-secondary">
            {`${formatMoneyPrecise(allocatableResidual(receipt), receipt.currency)} unapplied`}
          </span>
        )}
      </span>

      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-caption-2 text-text-secondary">
          {providerLabel(receipt.provider)}
        </span>
        <span className="text-caption-2 text-text-secondary font-mono" title={receipt.paymentRef}>
          {truncateReference(receipt.paymentRef)}
        </span>
      </span>

      {invoiceId === null && appointmentId === null ? (
        <span className="text-body-4 text-text-secondary">{'Not linked'}</span>
      ) : (
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {invoiceId !== null && (
            <Link
              href={`/finance?invoiceId=${encodeURIComponent(invoiceId)}`}
              className={linkClass}
            >
              {'Open invoice'}
            </Link>
          )}
          {appointmentId !== null && (
            <Link
              href={`/appointments?appointmentId=${encodeURIComponent(appointmentId)}`}
              className={linkClass}
            >
              {'Open appointment'}
            </Link>
          )}
        </span>
      )}

      {receipt.reason !== null && (
        <span className="text-body-4 text-text-secondary">{receipt.reason}</span>
      )}

      {/*
        The action is on the card rather than in a row of its own, and only
        where it can be taken. The table gives it a column; at phone widths
        there are no columns, and a full-width button per card would push the
        next capture off the screen.
      */}
      {onAllocate && canAllocate(receipt) && (
        <Secondary
          text="Apply"
          size="compact"
          className="w-fit"
          onClick={() => onAllocate(receipt)}
          ariaLabel={`Apply the payment captured on ${formatCapturedAt(receipt.capturedAt)}`}
        />
      )}
    </li>
  );
};

const PhoneReceiptList = ({
  receipts,
  onAllocate,
}: Readonly<{
  receipts: ProviderReceipt[];
  onAllocate?: (receipt: ProviderReceipt) => void;
}>) => (
  <ul
    className="flex flex-col gap-3 list-none pl-0!"
    aria-label="Captured payments and how far each one has been reconciled"
  >
    {receipts.map((receipt) => (
      <PhoneReceiptCard key={receipt.id} receipt={receipt} onAllocate={onAllocate} />
    ))}
  </ul>
);

export default PhoneReceiptList;
