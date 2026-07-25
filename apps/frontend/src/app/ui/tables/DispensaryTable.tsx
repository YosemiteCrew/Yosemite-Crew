'use client';
import React from 'react';
import { IoEye } from 'react-icons/io5';
import PaginatedGridTable, { GridHeaderCell } from '@/app/ui/tables/PaginatedGridTable';
import { DispensaryRecord, DispensaryStatus } from '@/app/features/inventory/pages/Inventory/types';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';

import './DataTable.css';

type DispensaryTableProps = {
  filteredList: DispensaryRecord[];
  onView?: (record: DispensaryRecord) => void;
  onDispense?: (record: DispensaryRecord) => void;
};

const PAGE_SIZE = 10;

const GRID_COLUMNS = '1.4fr 108px 1.6fr 116px 96px 130px 120px 116px 120px';

const HEADER_CELLS: GridHeaderCell[] = [
  { label: 'Request type' },
  { label: 'Status' },
  { label: 'Items' },
  { label: 'Requested' },
  { label: 'Amount', align: 'right', className: 'pr-4' },
  { label: 'Prescriber' },
  { label: 'Location' },
  { label: 'Dispensed' },
  { label: '' },
];

const STATUS_STYLES: Record<DispensaryStatus, React.CSSProperties> = {
  // Design renders a waiting request as the NEUTRAL "requested" pill, not an
  // amber warning — nothing is wrong yet, it simply has not been dispensed.
  PENDING: {
    color: 'var(--color-pill-neutral-text)',
    backgroundColor: 'var(--color-pill-neutral-bg)',
    borderColor: 'var(--color-pill-neutral-border)',
  },
  DISPENSED: {
    color: 'var(--color-pill-success-text)',
    backgroundColor: 'var(--color-pill-success-bg)',
    borderColor: 'var(--color-pill-success-border)',
  },
  NOT_DISPENSED: {
    color: 'var(--color-danger-600)',
    backgroundColor: 'var(--color-danger-100)',
    borderColor: 'var(--color-danger-400)',
  },
};

const STATUS_LABELS: Record<DispensaryStatus, string> = {
  PENDING: 'Pending',
  DISPENSED: 'Dispensed',
  NOT_DISPENSED: 'Not dispensed',
};

const formatAmount = (cents: number, currency = 'USD') => {
  const upper = currency.toUpperCase();
  const symbol = upper === 'USD' ? '$' : upper;
  return `${symbol} ${(cents / 100).toFixed(2)}`;
};

// Format dispensary timestamps in the viewer's own timezone (they used to be
// forced to UTC, #1879). Resolving it explicitly documents the intent and keeps
// the value deterministic; the table's rows are client-fetched, so there is no
// server-rendered value that could hydrate-mismatch.
const VIEWER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const formatDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      timeZone: VIEWER_TIME_ZONE,
    }) +
    '\n' +
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: VIEWER_TIME_ZONE,
    })
  );
};

const getDisplayName = (record: DispensaryRecord) => {
  const ownerLastName = record.petParentName
    ? record.petParentName.trim().split(/\s+/).at(-1)
    : null;
  return ownerLastName ? `${record.patient.name} • ${ownerLastName}` : record.patient.name;
};

const DispensaryStatusPill = ({ status }: { status: DispensaryStatus }) => (
  <StatusPill style={STATUS_STYLES[status]} label={STATUS_LABELS[status]} />
);

const DispensaryRow = ({
  record,
  onView,
  onDispense,
}: {
  record: DispensaryRecord;
  onView?: (record: DispensaryRecord) => void;
  onDispense?: (record: DispensaryRecord) => void;
}) => {
  const items = record.items ?? [];

  return (
    <div
      className="grid items-center gap-2.5 border-t border-card-border px-5 py-3 text-[13.5px] text-text-primary transition-colors hover:bg-[var(--surface-soft)]"
      style={{ gridTemplateColumns: GRID_COLUMNS }}
    >
      <div
        className="min-w-0 truncate text-[13px] font-bold text-[var(--ink)]"
        title={getDisplayName(record)}
      >
        {getDisplayName(record)}
      </div>
      <div className="flex justify-start">
        <DispensaryStatusPill status={record.status} />
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.length === 0 ? (
          <li className="text-[12px] text-text-tertiary">—</li>
        ) : (
          items.map((item) => (
            <li key={item.name} className="truncate text-[12px] text-text-secondary">
              • {item.name}
            </li>
          ))
        )}
      </ul>
      <div className="whitespace-pre-line text-[12px] tabular-nums text-[var(--color-success-600)]">
        {formatDateTime(record.prescriptionCreated)}
      </div>
      <div className="text-right font-semibold tabular-nums pr-4">
        {formatAmount(record.amountCents, record.currency)}
      </div>
      <div className="truncate text-[12.5px] text-text-secondary">{record.lead || '—'}</div>
      <div className="truncate text-[12.5px] text-text-secondary">{record.location || '—'}</div>
      <div
        className={`whitespace-pre-line text-[12px] tabular-nums ${
          record.timeDispensed ? 'text-[var(--color-success-600)]' : 'text-text-tertiary'
        }`}
      >
        {formatDateTime(record.timeDispensed)}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        {record.status === 'PENDING' && onDispense && (
          <button
            type="button"
            onClick={() => onDispense(record)}
            aria-label={`Dispense prescription for ${record.patient.name}`}
            className="flex h-8 items-center rounded-full! bg-[var(--cta)] px-3.5 text-[11.5px] font-bold text-[var(--cta-text)] transition-opacity hover:opacity-90"
          >
            Dispense
          </button>
        )}
        {onView && (
          <GlassTooltip content="View details" side="top">
            <button
              type="button"
              onClick={() => onView(record)}
              aria-label={`View prescription for ${record.patient.name}`}
              className="flex size-[30px] items-center justify-center rounded-full! border border-card-border text-text-secondary transition-colors hover:bg-card-hover"
            >
              <IoEye size={15} />
            </button>
          </GlassTooltip>
        )}
      </div>
    </div>
  );
};

const DispensaryCard = ({
  record,
  onView,
  onDispense,
}: {
  record: DispensaryRecord;
  onView?: (record: DispensaryRecord) => void;
  onDispense?: (record: DispensaryRecord) => void;
}) => (
  <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 p-3 flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <div className="text-body-3-emphasis text-text-primary truncate">
        {record.petParentName
          ? `${record.patient.name} • ${record.petParentName.trim().split(/\s+/).at(-1)}`
          : record.patient.name}
      </div>
      <DispensaryStatusPill status={record.status} />
    </div>
    {record.patient.petBreed && (
      <div className="text-caption-1 text-text-secondary">{record.patient.petBreed}</div>
    )}
    <div className="flex gap-1">
      <div className="text-caption-1 text-text-extra">Appointment:</div>
      <div className="text-caption-1 text-text-primary truncate">
        {record.patient.appointmentId}
      </div>
    </div>
    <div className="flex gap-1">
      <div className="text-caption-1 text-text-extra">Items:</div>
      <div className="text-caption-1 text-text-primary">
        {(record.items ?? []).map((i) => i.name).join(', ') || '—'}
      </div>
    </div>
    <div className="flex gap-1">
      <div className="text-caption-1 text-text-extra">Amount:</div>
      <div className="text-caption-1 text-text-primary">
        {formatAmount(record.amountCents, record.currency)}
      </div>
    </div>
    <div className="flex gap-1">
      <div className="text-caption-1 text-text-extra">Requested:</div>
      <div className="text-caption-1 text-text-primary">
        {formatDateTime(record.prescriptionCreated)}
      </div>
    </div>
    <div className="flex gap-2 mt-1">
      {record.status === 'PENDING' && onDispense && (
        <button
          type="button"
          onClick={() => onDispense(record)}
          className="flex-1 h-9 rounded-2xl bg-[var(--color-success-600)] text-white text-caption-1 font-semibold hover:opacity-90 transition-opacity"
        >
          Dispense
        </button>
      )}
      {onView && (
        <button
          type="button"
          onClick={() => onView(record)}
          className="flex-1 h-9 rounded-2xl border border-card-border text-caption-1 text-text-primary hover:bg-card-hover transition-colors"
        >
          View
        </button>
      )}
    </div>
  </div>
);

const DispensaryTable = ({ filteredList, onView, onDispense }: DispensaryTableProps) => (
  <PaginatedGridTable
    rows={filteredList}
    pageSize={PAGE_SIZE}
    gridColumns={GRID_COLUMNS}
    headerCells={HEADER_CELLS}
    itemNoun="requests"
    renderRow={(record) => (
      <DispensaryRow key={record.id} record={record} onView={onView} onDispense={onDispense} />
    )}
    renderCard={(record) => (
      <DispensaryCard key={record.id} record={record} onView={onView} onDispense={onDispense} />
    )}
  />
);

export default DispensaryTable;
