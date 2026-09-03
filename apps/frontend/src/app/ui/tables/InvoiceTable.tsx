import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { toTitle } from '@/app/lib/validators';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { NoDataMessage, emptyStateCopy } from '@/app/ui/tables/common';
import InvoiceCard from '@/app/ui/cards/InvoiceCard';
import { Invoice } from '@yosemite-crew/types';
import { useInvoiceRowRenderers } from '@/app/ui/tables/useInvoiceRowRenderers';
import { getInvoiceNumberLabel } from '@/app/lib/invoice';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';
import { getInvoiceItemNames, getInvoiceStatusTone } from '@/app/ui/tables/tableUtils';

import './DataTable.css';

/* Tablet (768–1279) prunes to <= 6 columns per "PIMS Responsive · Foundations",
   Adaptation rules: "tablet prunes to <=6 columns, meta folds into the sub-line".
   Services and the appointment date/time fold into the Parent / patient sub-line;
   Subtotal / Discount / Tax fold under Total. */

/* The status micro-badge is `white-space: nowrap` + `width: fit-content` +
   `overflow-hidden`, so an undersized column doesn't bleed the pill over the
   Payment cell — it silently clips the label instead ("AWAITING PAYMENT" ->
   "AWAITING PAYME"). The widest label measures 133.7px at 10px/700/0.08em
   Satoshi; 160px (- 22px td padding = 138px) left only ~4px of slack, which
   real-world font hinting/zoom/DPI variance ate into. 180px leaves a real
   margin (~23px). */
const STATUS_COLUMN_WIDTH = '180px';

/* Same failure one column over, and the only other fixed-width table cell whose
   own header does not fit: "Actions" needs 53.3px of Satoshi and the th carries
   31px of padding, so the shipped 64px (45px of content box) ellipsised the
   header itself to "Action..." on every desktop viewport, and the 56px tablet
   value cut it in half. This is the one table with `table-layout: fixed`, so
   unlike every other PIMS table it cannot grow a column to fit its label. 88px
   leaves ~4px of slack. */
const ACTIONS_COLUMN_WIDTH = '88px';

/**
 * The identity cell's leading line: "owner / patient" when both are known, and
 * whichever one is known otherwise. An invoice converted from an estimate has
 * no appointment, so either side can legitimately be missing; a missing side
 * must not leave a stray separator behind.
 */

const renderInvoiceNumber = (item: Invoice) => (
  // The identity cell never breaks mid-word (table recipe): "#53F6F0925E" used to
  // wrap to two lines inside its 96px column and read as two invoices.
  <div
    className="appointment-profile-title tabular-nums cell-strong whitespace-nowrap"
    title={getInvoiceNumberLabel(item) || undefined}
  >
    {getInvoiceNumberLabel(item) || '-'}
  </div>
);

const renderServices = (item: Invoice) => {
  // A comma-joined line-item list in a 180px column wrapped to as many lines as
  // the invoice had items, so one busy row set the height of the whole page.
  const names = getInvoiceItemNames(item.items);
  return (
    <div className="appointment-profile-title cell-muted cell-truncate" title={names || undefined}>
      {names}
    </div>
  );
};

const renderStatus = (item: Invoice) => (
  <StatusPill tone={getInvoiceStatusTone(item?.status)} label={toTitle(item?.status)} />
);

const renderPayment = (item: Invoice) => (
  <div className="appointment-profile-title cell-muted">{getInvoicePaymentMethodLabel(item)}</div>
);

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InvoiceTableProps = {
  filteredList: Invoice[];
  setActiveInvoice?: (inventory: Invoice) => void;
  setViewInvoice?: (open: boolean) => void;
};

const InvoiceTable = ({ filteredList, setActiveInvoice, setViewInvoice }: InvoiceTableProps) => {
  /* The cell renderers and the lookups they close over live in a hook, so this
     component is the three responsive bands and the column definitions. It was
     about 305 lines, two thirds of them renderers. No JSX moved, so the DOM and
     the per-band story assertions are unchanged. */
  const {
    handleViewInvoice,
    renderParent,
    renderDate,
    renderSubtotal,
    renderTax,
    renderTotal,
    renderActions,
  } = useInvoiceRowRenderers({ setActiveInvoice, setViewInvoice });

  /* Desktop (>= 1280): the design's ledger — Subtotal, Tax and Total each get a
     column. Discount is deliberately NOT one of them: it only appears in the
     invoice detail Summary, where the line-level breakdown lives. */
  const columns: Column<Invoice>[] = [
    { label: 'Invoice', key: 'invoice-number', width: '112px', render: renderInvoiceNumber },
    {
      label: 'Parent / patient',
      key: 'appointment-id',
      width: '200px',
      render: (item: Invoice) => renderParent(item, false),
    },
    { label: 'Services', key: 'service', width: '180px', render: renderServices },
    { label: 'Appointment', key: 'date', width: '150px', render: renderDate },
    { label: 'Subtotal', key: 'sub-total', width: '104px', render: renderSubtotal },
    { label: 'Tax', key: 'tax', width: '96px', render: renderTax },
    {
      label: 'Total',
      key: 'total',
      width: '104px',
      render: (item: Invoice) => renderTotal(item, false),
    },
    { label: 'Status', key: 'status', width: STATUS_COLUMN_WIDTH, render: renderStatus },
    { label: 'Payment', key: 'payment', width: '110px', render: renderPayment },
    { label: 'Actions', key: 'actions', width: ACTIONS_COLUMN_WIDTH, render: renderActions },
  ];

  /* Tablet (768–1279): 6 columns — the ones you need to chase money.
     Invoice (the reference you quote), Parent / patient (who owes, fluid so it
     absorbs the slack), Total (the amount at stake), Status (paid or not — the
     point of the page), Payment (how it settles, which decides your next move),
     Actions. Services + Appointment fold into the identity sub-line; Subtotal /
     Discount / Tax fold under Total. */
  const tabletColumns: Column<Invoice>[] = [
    { label: 'Invoice', key: 'invoice-number', width: '104px', render: renderInvoiceNumber },
    {
      label: 'Parent / patient',
      key: 'appointment-id',
      render: (item: Invoice) => renderParent(item, true),
    },
    {
      label: 'Total',
      key: 'total',
      width: '104px',
      render: (item: Invoice) => renderTotal(item, true),
    },
    { label: 'Status', key: 'status', width: STATUS_COLUMN_WIDTH, render: renderStatus },
    { label: 'Payment', key: 'payment', width: '108px', render: renderPayment },
    { label: 'Actions', key: 'actions', width: ACTIONS_COLUMN_WIDTH, render: renderActions },
  ];

  return (
    <div className="table-wrapper invoice-scroll-x h-full min-h-0 overflow-hidden">
      {/* Finance deliberately does NOT use the shared `.table-list` / `.card-list`
          classes: DataTable.css hides `.table-list` at <=1280 and forces
          `.card-list` on, which would skip the design's tablet table entirely.
          Visibility here is pure Tailwind so the three bands can't disagree. */}
      <div className="hidden xl:flex h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          itemNoun="invoices"
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={10}
          tableClassName="invoice-table-fixed"
          caption="Invoices with appointment details, totals, statuses, payment methods, and actions"
        />
      </div>
      <div className="hidden md:flex xl:hidden h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          itemNoun="invoices"
          data={filteredList}
          columns={tabletColumns}
          bordered={false}
          pagination
          pageSize={10}
          tableClassName="invoice-compact-fixed table-fixed min-w-[540px]"
          caption="Invoices with parent and patient, totals, statuses, payment methods, and actions"
        />
      </div>
      <div className="flex md:hidden gap-4 sm:gap-6 flex-wrap content-start">
        {(() => {
          if (filteredList.length === 0) {
            return (
              /* Was a bare sentence reading "No invoices match the current
                 filters." — which blamed the filters even when the practice
                 simply has no invoices yet, and looked nothing like the card the
                 two table bands show one breakpoint up. Same derived copy as
                 those bands now, so the sentence no longer depends on window
                 width. The `output`/`aria-live` wrapper is kept: all three bands
                 are mounted at every width, but a hidden one is not announced,
                 so only the band the reader is actually on speaks. */
              <output className="w-full" aria-live="polite">
                <NoDataMessage {...emptyStateCopy('invoices')} />
              </output>
            );
          }
          return filteredList.map((item, i) => (
            <InvoiceCard
              key={item.id || 'invoice-key' + i}
              invoice={item}
              handleViewInvoice={handleViewInvoice}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default InvoiceTable;
