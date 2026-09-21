'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { NoDataMessage } from '@/app/ui/tables/common';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';
import PhoneReceiptList from '@/app/features/finance/pages/PaymentReconciliation/Sections/PhoneReceiptList';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { Secondary } from '@/app/ui/primitives/Buttons';
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

type ReconciliationTableProps = {
  receipts: ProviderReceipt[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** Changes the empty state: "nothing captured yet" is not "nothing matches". */
  isFiltered: boolean;
  onLoadMore: () => void;
};

const linkClass = 'text-body-4 text-blue-text underline underline-offset-2 hover:opacity-80';

const CapturedCell = (receipt: ProviderReceipt) => (
  <span className="text-body-4 text-text-primary whitespace-nowrap">
    {formatCapturedAt(receipt.capturedAt)}
  </span>
);

/**
 * Captured, with what is left of it underneath once anything has been given
 * back. A partly refunded capture shown at its full amount is the reading that
 * makes a reconciliation balance to the wrong number.
 */
const AmountCell = (receipt: ProviderReceipt) => (
  <span className="flex flex-col">
    <span className="text-body-4 text-text-primary whitespace-nowrap">
      {formatMoneyPrecise(receipt.amount, receipt.currency)}
    </span>
    {receipt.refundedAmount > 0 && (
      <span className="text-caption-2 text-text-secondary whitespace-nowrap">
        {`${formatMoneyPrecise(netCaptured(receipt), receipt.currency)} after ${formatMoneyPrecise(
          receipt.refundedAmount,
          receipt.currency
        )} refunded`}
      </span>
    )}
  </span>
);

const StateCell = (receipt: ProviderReceipt) => (
  <StatusPill
    label={statusLabel(receipt.status)}
    tone={statusTone(receipt.status)}
    className="w-fit"
  />
);

/**
 * The provider's own reference for the capture. Operational data for the staff
 * who can already read this queue, truncated for the column with the whole
 * value on `title` so nobody copies half a reference without knowing it.
 */
const PaymentCell = (receipt: ProviderReceipt) => (
  <span className="flex flex-col">
    <span className="text-body-4 text-text-primary">{providerLabel(receipt.provider)}</span>
    <span className="text-caption-2 text-text-secondary font-mono" title={receipt.paymentRef}>
      {truncateReference(receipt.paymentRef)}
    </span>
  </span>
);

/**
 * Where the capture came from, as links rather than ids.
 *
 * An unattributed capture genuinely has neither, and says so: the queue exists
 * because that state is real, and rendering a dead link for it would suggest
 * there is somewhere to go.
 */
const SourceCell = (receipt: ProviderReceipt) => {
  // Destructured so each id narrows to a string inside its own guard. Reading
  // them off `receipt` needed a `?? ''` fallback that no input can reach - an
  // unreachable branch that no test can honestly cover.
  const { invoiceId, appointmentId } = receipt;

  if (invoiceId === null && appointmentId === null) {
    return <span className="text-body-4 text-text-secondary">{'Not linked'}</span>;
  }

  return (
    <span className="flex flex-col items-start gap-0.5">
      {invoiceId !== null && (
        <Link href={`/finance?invoiceId=${encodeURIComponent(invoiceId)}`} className={linkClass}>
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
  );
};

const ReasonCell = (receipt: ProviderReceipt) => (
  <span className="text-body-4 text-text-secondary">{receipt.reason ?? '—'}</span>
);

const COLUMNS = [
  { label: 'Captured', key: 'capturedAt', render: CapturedCell },
  { label: 'Amount', key: 'amount', render: AmountCell },
  { label: 'State', key: 'status', render: StateCell },
  { label: 'Payment', key: 'paymentRef', render: PaymentCell },
  { label: 'Source', key: 'source', render: SourceCell },
  { label: 'Why', key: 'reason', render: ReasonCell },
];

const LoadingRows = () => (
  <div className="flex flex-col gap-2" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((row) => (
      <div key={row} className="h-12 rounded-2xl bg-card-hover animate-pulse" />
    ))}
  </div>
);

const emptyCopy = (isFiltered: boolean) =>
  isFiltered
    ? {
        emptyTitle: 'No captured payments match these filters',
        emptySubtitle: 'Widen the date range, or choose a different state.',
      }
    : {
        emptyTitle: 'No captured payments yet',
        emptySubtitle: 'Card payments are journalled here as soon as the provider captures them.',
      };

/**
 * The queue itself (#3170 delivery 3).
 *
 * Read-only on purpose. Applying a capture to an invoice moves money and is a
 * separate, permissioned action; shipping a button for it before that route is
 * live would be an action that looks available and is not.
 */
const ReconciliationTable = ({
  receipts,
  loading,
  loadingMore,
  hasMore,
  isFiltered,
  onLoadMore,
}: Readonly<ReconciliationTableProps>) => {
  const empty = useMemo(() => emptyCopy(isFiltered), [isFiltered]);
  const isPhone = useIsPhone();

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-body-4 text-text-secondary" aria-live="polite">
          {'Loading captured payments...'}
        </p>
        <LoadingRows />
      </div>
    );
  }

  /*
   * The empty copy is passed to both branches from the same place. The table
   * and the phone list describing one empty dataset two different ways either
   * side of 768px is a defect this repo has shipped before.
   */
  const body = isPhone ? (
    <PhoneReceiptList receipts={receipts} />
  ) : (
    <GenericTable
      data={receipts}
      columns={COLUMNS}
      itemNoun="captured payments"
      caption="Captured payments and how far each one has been reconciled"
      emptyTitle={empty.emptyTitle}
      emptySubtitle={empty.emptySubtitle}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {isPhone && receipts.length === 0 ? (
        <NoDataMessage title={empty.emptyTitle} subtitle={empty.emptySubtitle} />
      ) : (
        body
      )}
      {hasMore && (
        <div className="flex justify-center!">
          <Secondary
            text={loadingMore ? 'Loading...' : 'Load more'}
            isDisabled={loadingMore}
            onClick={onLoadMore}
            ariaLabel="Load more captured payments"
          />
        </div>
      )}
    </div>
  );
};

export default ReconciliationTable;
