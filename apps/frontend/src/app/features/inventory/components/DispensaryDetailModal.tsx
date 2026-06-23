'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { FiX, FiArrowRight, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { FaCheckCircle } from 'react-icons/fa';
import Modal from '@/app/ui/overlays/Modal';
import { DispensaryRecord } from '@/app/features/inventory/pages/Inventory/types';
import {
  dispensePrescription,
  notDispensedPrescription,
} from '@/app/features/appointments/services/prescriptionWorkflowService';

type Props = {
  record: DispensaryRecord;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  organisationId: string;
  onActionComplete: () => void;
};

const formatCents = (cents: number, currency?: string) => {
  const upper = (currency ?? 'USD').toUpperCase();
  const symbol = upper === 'USD' ? '$' : upper;
  return `${symbol} ${(cents / 100).toFixed(2)}`;
};

const RequestTypeChip = ({ type }: { type: 'PATIENT' | 'IN_HOUSE' }) => (
  <span className="inline-flex h-8 items-center rounded-full border px-4 text-body-4 border-blue-text bg-[var(--color-primary-100)] text-blue-text">
    {type === 'PATIENT' ? 'Patient' : 'Inhouse'}
  </span>
);

const PaymentBadge = ({ status }: { status?: 'PAID' | 'UNPAID' }) => {
  if (!status) return null;
  return (
    <span
      className={`inline-flex h-8 items-center rounded-full border px-4 text-body-4 ${
        status === 'PAID'
          ? 'border-[var(--color-pill-success-border)] bg-[var(--color-pill-success-bg)] text-[var(--color-pill-success-text)]'
          : 'border-[var(--color-pill-warning-border)] bg-[var(--color-pill-warning-bg)] text-[var(--color-pill-warning-text)]'
      }`}
    >
      {status === 'PAID' ? 'Paid' : 'Unpaid'}
    </span>
  );
};

const DispensaryDetailModal = ({
  record,
  showModal,
  setShowModal,
  organisationId,
  onActionComplete,
}: Props) => {
  const isDispensed = record.status === 'DISPENSED';
  const items = record.items ?? [];
  const pendingCount = items.length;
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [actioning, setActioning] = useState(false);

  const togglePrescription = (idx: number) => setExpandedIdx((prev) => (prev === idx ? null : idx));

  const handleDispense = async () => {
    if (actioning) return;
    setActioning(true);
    try {
      await dispensePrescription(organisationId, record.prescriptionId);
      setShowModal(false);
      onActionComplete();
    } finally {
      setActioning(false);
    }
  };

  const handleNotDispensed = async () => {
    if (actioning) return;
    setActioning(true);
    try {
      await notDispensedPrescription(organisationId, record.prescriptionId);
      setShowModal(false);
      onActionComplete();
    } finally {
      setActioning(false);
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-5 border-b border-card-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">
              {isDispensed ? 'Dispensed request' : 'Dispense request'}
            </h2>
            {isDispensed && (
              <FaCheckCircle size={20} className="text-[var(--color-success-600)] shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <RequestTypeChip type={record.requestType} />
            <button
              type="button"
              onClick={() => setShowModal(false)}
              aria-label="Close"
              className="inline-flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-card-hover transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto pt-5 pr-1">
          {/* Patient info */}
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-hover">
              {record.patient.imageUrl ? (
                <Image
                  src={record.patient.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-body-3-emphasis text-text-secondary">
                  {record.patient.name === '—' ? '?' : record.patient.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex flex-1 items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="text-body-3-emphasis text-text-primary">{record.patient.name}</div>
                {record.patient.petBreed && (
                  <div className="text-body-4 text-text-secondary">{record.patient.petBreed}</div>
                )}
                {record.patient.petAge && (
                  <div className="text-body-4 text-text-secondary">{record.patient.petAge}</div>
                )}
              </div>
              <div className="flex gap-4 text-caption-1 shrink-0">
                {record.patient.appointmentId !== '—' && (
                  <div className="max-w-[110px]">
                    <div className="text-text-secondary">Appointment ID</div>
                    <div className="text-text-primary font-semibold truncate">
                      {record.patient.appointmentId}
                    </div>
                  </div>
                )}
                {record.invoiceId && (
                  <div className="max-w-[110px]">
                    <div className="text-text-secondary">Invoice ID</div>
                    <div className="text-text-primary font-semibold truncate">
                      {record.invoiceId}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Doctor + payment */}
          <div className="flex items-center justify-between">
            <div className="inline-flex h-10 items-center gap-2 rounded-2xl border border-card-border bg-[var(--color-neutral-100,#f3f4f6)] px-4 text-body-4 text-text-primary">
              <span>{record.lead || '—'}</span>
              {record.lead && record.lead !== '—' && (
                <FiChevronDown size={14} className="text-text-secondary shrink-0" />
              )}
            </div>
            <PaymentBadge status={record.paymentStatus} />
          </div>

          {/* Items list */}
          {items.length > 0 ? (
            <div className="flex flex-col divide-y divide-card-border">
              {items.map((item, idx) => {
                const isExpanded = expandedIdx === idx;
                const hasPrescription = !!item.prescription;
                return (
                  <div key={item.name} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => hasPrescription && togglePrescription(idx)}
                      className={`flex w-full items-center gap-2 text-left ${hasPrescription ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="text-body-4 text-text-secondary shrink-0">{idx + 1}.</span>
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        <span className="text-body-4 text-text-primary font-semibold truncate">
                          {item.name}
                        </span>
                        {item.isRx && (
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-blue-text text-white text-[10px] font-bold shrink-0">
                            Rx
                          </span>
                        )}
                        {item.isControlled && (
                          <span className="inline-flex items-center rounded-full border border-card-border bg-[var(--color-neutral-100,#f3f4f6)] px-2 py-0.5 text-caption-1 text-text-secondary shrink-0">
                            Controlled
                          </span>
                        )}
                      </div>
                      <span className="text-body-4 font-semibold text-[var(--color-success-600)] shrink-0">
                        {item.quantity}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-[var(--color-primary-100)] px-3 py-0.5 text-body-4-emphasis text-blue-text shrink-0">
                        {formatCents(item.priceCents, record.currency)}
                      </span>
                      {hasPrescription && (
                        <span className="text-text-secondary shrink-0">
                          {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                        </span>
                      )}
                    </button>
                    {hasPrescription && isExpanded && (
                      <div className="ml-5 rounded-xl border border-card-border bg-[var(--color-neutral-50,#f9fafb)] p-3">
                        <div className="text-caption-1 text-text-secondary mb-2">Prescription:</div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-caption-1 text-text-primary">
                          {item.prescription!.dose && (
                            <span>
                              <span className="text-text-secondary">Dose </span>
                              {item.prescription!.dose}
                            </span>
                          )}
                          {item.prescription!.route && (
                            <span>
                              <span className="text-text-secondary">Route </span>
                              {item.prescription!.route}
                            </span>
                          )}
                          {item.prescription!.freq && (
                            <span>
                              <span className="text-text-secondary">Freq. </span>
                              {item.prescription!.freq}
                            </span>
                          )}
                          {item.prescription!.duration && (
                            <span>
                              <span className="text-text-secondary">Duration </span>
                              {item.prescription!.duration}
                            </span>
                          )}
                          {item.prescription!.refill && (
                            <span>
                              <span className="text-text-secondary">Refill </span>
                              {item.prescription!.refill}
                            </span>
                          )}
                          {!item.prescription!.dose &&
                            !item.prescription!.route &&
                            !item.prescription!.freq && (
                              <span className="text-text-secondary">
                                No prescription details available
                              </span>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-body-4 text-text-secondary">
              No items recorded
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 pt-5 mt-5 border-t border-card-border">
          {isDispensed ? (
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-text-primary bg-white px-5 text-body-4-emphasis text-text-primary hover:bg-card-hover transition-colors"
              >
                <span>Prescription</span>
                <FiArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDispense}
                disabled={actioning}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-text-primary px-5 text-body-4-emphasis text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Dispense all ({pendingCount})
              </button>
              <button
                type="button"
                onClick={handleNotDispensed}
                disabled={actioning}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--color-danger-600)] px-5 text-body-4-emphasis text-[var(--color-danger-600)] hover:bg-[var(--color-danger-100)] transition-colors disabled:opacity-50"
              >
                Not dispensed
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DispensaryDetailModal;
