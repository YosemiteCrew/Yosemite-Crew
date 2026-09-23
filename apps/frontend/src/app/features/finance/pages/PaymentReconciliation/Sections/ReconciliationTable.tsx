'use client';
import React from 'react';
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
  allocatableResidual,
  canAllocate,
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
  /**
   * Undefined for a reader without `billing:edit:any`, and then no action
   * column is rendered at all rather than a disabled one. Reading the queue is
   * what every billing role needs; moving money is not, and a control that
   * only ever refuses is worse than its absence.
   */
  onAllocate?: (receipt: ProviderReceipt) => void;
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
    {/*
      What is left to apply, shown only while there is something to do about
      it. On a settled row it repeats the amount above; on the rows this queue
      exists for it is the figure the allocate action is decided from, and
      until now the column could not state it at all.
    */}
    {receipt.allocatedAmount > 0 && allocatableResidual(receipt) > 0 && (
      <span className="text-caption-2 text-text-secondary whitespace-nowrap">
        {`${formatMoneyPrecise(allocatableResidual(receipt), receipt.currency)} unapplied`}
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

const BASE_COLUMNS = [
  { label: 'Captured', key: 'capturedAt', render: CapturedCell },
  { label: 'Amount', key: 'amount', render: AmountCell },
  { label: 'State', key: 'status', render: StateCell },
  { label: 'Payment', key: 'paymentRef', render: PaymentCell },
  { label: 'Source', key: 'source', render: SourceCell },
  { label: 'Why', key: 'reason', render: ReasonCell },
];

/**
 * The action, on the rows that can take it.
 *
 * `canAllocate` mirrors three of the route's own refusals, so a capture nobody
 * owns, one refunded in full and one already fully applied get no button
 * rather than one that opens a dialog only to say no.
 */
const buildColumns = (onAllocate: (receipt: ProviderReceipt) => void) => [
  ...BASE_COLUMNS,
  {
    label: 'Action',
    key: 'allocate',
    render: (receipt: ProviderReceipt) =>
      canAllocate(receipt) ? (
        <Secondary
          text="Apply"
          size="compact"
          onClick={() => onAllocate(receipt)}
          ariaLabel={`Apply the payment captured on ${formatCapturedAt(receipt.capturedAt)}`}
        />
      ) : (
        <span className="text-body-4 text-text-secondary">{'\u2014'}</span>
      ),
  },
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
 * The queue itself (#3170 delivery 3), and the action it leads to.
 *
 * The action column arrived once the allocate route did. Until then the screen
 * was deliberately read-only - a button for a route that was still open would
 * have been an action that looks available and is not - and until it arrived
 * the endpoint had no caller, so an operator could see an unapplied capture
 * and still needed an API client to do anything about it.
 */
const ReconciliationTable = ({
  receipts,
  loading,
  loadingMore,
  hasMore,
  isFiltered,
  onLoadMore,
  onAllocate,
}: Readonly<ReconciliationTableProps>) => {
  const empty = emptyCopy(isFiltered);
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
    <PhoneReceiptList receipts={receipts} onAllocate={onAllocate} />
  ) : (
    <GenericTable
      data={receipts}
      columns={onAllocate ? buildColumns(onAllocate) : BASE_COLUMNS}
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
