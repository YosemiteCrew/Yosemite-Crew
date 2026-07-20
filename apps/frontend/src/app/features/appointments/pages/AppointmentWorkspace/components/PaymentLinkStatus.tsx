'use client';
import React from 'react';
import type { PaymentLinkStatus as PaymentLinkStatusModel } from '@/app/features/appointments/lib/paymentLinkStatus';
import './PaymentLinkStatus.css';

/**
 * The design's muted status line under the Collect action: a pulsing --success
 * dot plus the payment-link state. Rendered only when the caller has a real
 * status to show, so an invoice with no payment link shows nothing at all.
 */
const PaymentLinkStatus = ({ status }: { status: PaymentLinkStatusModel | null }) => {
  if (!status) return null;
  return (
    <output
      className="flex items-center justify-center gap-1.5 text-[11.5px]"
      style={{ color: 'var(--ink-faint)' }}
    >
      <span
        aria-hidden="true"
        className="yc-workspace-pulse-dot size-1.5 shrink-0 rounded-full"
        style={{ background: 'var(--success)' }}
      />
      {status.label}
    </output>
  );
};

export default PaymentLinkStatus;
