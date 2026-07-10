'use client';
import React, { useState } from 'react';
import { IoEye } from 'react-icons/io5';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { DispensaryRecord, DispensaryStatus } from '@/app/features/inventory/pages/Inventory/types';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

import './DataTable.css';

type DispensaryTableProps = {
  filteredList: DispensaryRecord[];
  onView?: (record: DispensaryRecord) => void;
  onDispense?: (record: DispensaryRecord) => void;
};

const PAGE_SIZE = 10;

const GRID_COLUMNS = '1.4fr 108px 1.6fr 116px 96px 130px 120px 116px 120px';

const HEADER_CELLS: { label: string; align?: 'right' }[] = [
  { label: 'Request type' },
  { label: 'Status' },
  { label: 'Items' },
  { label: 'Requested' },
  { label: 'Amount', align: 'right' },
  { label: 'Lead' },
  { label: 'Location' },
  { label: 'Dispensed' },
  { label: '' },
];

const STATUS_STYLES: Record<DispensaryStatus, React.CSSProperties> = {
  PENDING: {
    color: 'var(--color-pill-warning-text)',
    backgroundColor: 'var(--color-pill-warning-bg)',
    borderColor: 'var(--color-pill-warning-border)',
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

const formatDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) +
    '\n' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
};

const getDisplayName = (record: DispensaryRecord) => {
  const ownerLastName = record.petParentName
    ? record.petParentName.trim().split(/\s+/).at(-1)
    : null;
  return ownerLastName ? `${record.patient.name} • ${ownerLastName}` : record.patient.name;
};

const StatusPill = ({ status }: { status: DispensaryStatus }) => (
  <span
    className="inline-flex items-center rounded-full border px-2.5 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap"
    style={STATUS_STYLES[status]}
  >
    {STATUS_LABELS[status]}
  </span>
);

const DispensaryRow = ({
  record,
  onView,
  onDispense,
}: {
  record: DispensaryRecord;
  onView?: (record: DispensaryRecord) => void;
  onDispense?: (record: DispensaryRecord) => void;
}) => (
  <div
    className="grid items-center gap-2.5 border-t border-card-border px-5 py-2.5 text-[13px] text-text-primary transition-colors hover:bg-[var(--surface-soft)]"
    style={{ gridTemplateColumns: GRID_COLUMNS }}
  >
    <div
      className="min-w-0 truncate text-[13px] font-bold text-text-primary"
      title={getDisplayName(record)}
    >
      {getDisplayName(record)}
    </div>
    <div>
      <StatusPill status={record.status} />
    </div>
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {(record.items ?? []).length === 0 ? (
        <li className="text-[12px] text-text-tertiary">—</li>
      ) : (
        (record.items ?? []).map((item) => (
          <li key={item.name} className="truncate text-[12px] text-text-secondary">
            • {item.name}
          </li>
        ))
      )}
    </ul>
    <div className="whitespace-pre-line text-[12px] tabular-nums text-[var(--color-success-600)]">
      {formatDateTime(record.prescriptionCreated)}
    </div>
    <div className="text-right font-semibold tabular-nums">
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

const DispensaryTable = ({ filteredList, onView, onDispense }: DispensaryTableProps) => {
  const [page, setPage] = useState(1);

  const total = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  if (currentPage !== page) setPage(currentPage);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredList.slice(startIdx, startIdx + PAGE_SIZE);
  const showPagination = totalPages > 1;

  return (
    <div className="table-wrapper inventory-scroll-x h-full min-h-0 overflow-hidden">
      <div className="inventory-table-list h-full min-h-0 flex-1">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="min-w-[1080px]">
              <div
                className="sticky top-0 z-10 grid items-center gap-2.5 bg-[var(--screen-2)] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.09em] text-text-tertiary"
                style={{ gridTemplateColumns: GRID_COLUMNS }}
              >
                {HEADER_CELLS.map((cell, index) => (
                  <span
                    key={cell.label || `col-${index}`}
                    className={cell.align === 'right' ? 'text-right' : ''}
                  >
                    {cell.label}
                  </span>
                ))}
              </div>
              {total === 0 ? (
                <div className="flex w-full items-center justify-center border-t border-card-border py-10 text-body-4 text-text-primary">
                  Looks like a quiet day… for now.
                </div>
              ) : (
                pageRows.map((record) => (
                  <DispensaryRow
                    key={record.id}
                    record={record}
                    onView={onView}
                    onDispense={onDispense}
                  />
                ))
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-card-border px-5 py-3 text-[12.5px] text-text-tertiary">
            <span>
              {total === 0
                ? 'No requests'
                : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, total)} of ${total} requests`}
            </span>
            {showPagination && (
              <span className="flex items-center gap-2">
                <Back
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={currentPage === 1 ? 'cursor-not-allowed opacity-40' : ''}
                />
                <span className="tabular-nums text-text-secondary">
                  {currentPage} / {totalPages}
                </span>
                <Next
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? 'cursor-not-allowed opacity-40' : ''}
                />
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="inventory-card-list gap-4 sm:gap-6 flex-wrap">
        {filteredList.length === 0 ? (
          <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
            No data available
          </div>
        ) : (
          filteredList.map((record) => (
            <div
              key={record.id}
              className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-body-3-emphasis text-text-primary truncate">
                  {record.petParentName
                    ? `${record.patient.name} • ${record.petParentName.trim().split(/\s+/).at(-1)}`
                    : record.patient.name}
                </div>
                <div className="appointment-status shrink-0" style={STATUS_STYLES[record.status]}>
                  {STATUS_LABELS[record.status]}
                </div>
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
          ))
        )}
      </div>
    </div>
  );
};

export default DispensaryTable;
