'use client';
import React from 'react';
import Link from 'next/link';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { formatMoneyPrecise } from '@/app/lib/money';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';
import {
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
const PhoneReceiptCard = ({ receipt }: { receipt: ProviderReceipt }) => {
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
    </li>
  );
};

const PhoneReceiptList = ({ receipts }: Readonly<{ receipts: ProviderReceipt[] }>) => (
  <ul
    className="flex flex-col gap-3 list-none pl-0!"
    aria-label="Captured payments and how far each one has been reconciled"
  >
    {receipts.map((receipt) => (
      <PhoneReceiptCard key={receipt.id} receipt={receipt} />
    ))}
  </ul>
);

export default PhoneReceiptList;
