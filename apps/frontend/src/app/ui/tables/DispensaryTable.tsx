'use client';
import React from 'react';
import Image from 'next/image';
import { IoEye } from 'react-icons/io5';
import { FiCheck } from 'react-icons/fi';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { DispensaryRecord, DispensaryStatus } from '@/app/features/inventory/pages/Inventory/types';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

import './DataTable.css';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type DispensaryTableProps = {
  filteredList: DispensaryRecord[];
  onView?: (record: DispensaryRecord) => void;
  onDispense?: (record: DispensaryRecord) => void;
};

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

const DispensaryTable = ({ filteredList, onView, onDispense }: DispensaryTableProps) => {
  const columns: Column<DispensaryRecord>[] = [
    {
      label: 'Request type',
      key: 'patient',
      width: '170px',
      render: (record) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-hover">
            {record.patient.imageUrl ? (
              <Image
                src={record.patient.imageUrl}
                alt=""
                width={40}
                height={40}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-body-4 text-text-secondary font-semibold">
                {record.patient.name === '—' ? '?' : record.patient.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="appointment-profile-title leading-tight">{record.patient.name}</div>
            {record.patient.petBreed && (
              <div className="text-caption-1 text-text-secondary">{record.patient.petBreed}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '120px',
      render: (record) => (
        <div className="appointment-status" style={STATUS_STYLES[record.status]}>
          {STATUS_LABELS[record.status]}
        </div>
      ),
    },
    {
      label: 'Items',
      key: 'prescriptionItems',
      width: '180px',
      render: (record) => (
        <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
          {(record.items ?? []).map((item) => (
            <li key={item.name} className="appointment-profile-title text-caption-1">
              • {item.name}
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: 'Request created',
      key: 'prescriptionCreated',
      width: '120px',
      render: (record) => (
        <div className="appointment-profile-title text-[var(--color-success-600)] whitespace-pre-line">
          {formatDateTime(record.prescriptionCreated)}
        </div>
      ),
    },
    {
      label: 'Amount',
      key: 'amountCents',
      width: '90px',
      render: (record) => (
        <div className="appointment-profile-title font-semibold">
          {formatAmount(record.amountCents, record.currency)}
        </div>
      ),
    },
    {
      label: 'Lead',
      key: 'lead',
      width: '140px',
      render: (record) => <div className="appointment-profile-title">{record.lead || '—'}</div>,
    },
    {
      label: 'Location',
      key: 'location',
      width: '110px',
      render: (record) => <div className="appointment-profile-title">{record.location || '—'}</div>,
    },
    {
      label: 'Time Dispensed',
      key: 'timeDispensed',
      width: '110px',
      render: (record) => (
        <div
          className={`appointment-profile-title whitespace-pre-line ${record.timeDispensed ? 'text-[var(--color-success-600)]' : ''}`}
        >
          {formatDateTime(record.timeDispensed)}
        </div>
      ),
    },
    {
      label: 'Action',
      key: 'actions',
      width: '96px',
      render: (record) => (
        <div className="action-btn-col">
          {record.status === 'PENDING' && onDispense && (
            <GlassTooltip content="Mark as dispensed" side="top">
              <button
                type="button"
                onClick={() => onDispense(record)}
                aria-label={`Dispense prescription for ${record.patient.name}`}
                className="size-10 rounded-full border border-[var(--color-success-600)] flex items-center justify-center cursor-pointer bg-[var(--color-success-600)] hover:opacity-80 transition-opacity"
              >
                <FiCheck size={18} color="white" />
              </button>
            </GlassTooltip>
          )}
          {onView && (
            <GlassTooltip content="View details" side="top">
              <button
                type="button"
                onClick={() => onView(record)}
                aria-label={`View prescription for ${record.patient.name}`}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full border border-black-text flex items-center justify-center cursor-pointer"
              >
                <IoEye size={20} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper inventory-scroll-x h-full min-h-0 overflow-hidden">
      <div className="inventory-table-list h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={10}
          tableClassName="inventory-table-fixed"
        />
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
              className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-body-3-emphasis text-text-primary truncate">
                  {record.patient.name}
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
