'use client';
import React, { useState } from 'react';
import { FiX, FiPrinter } from 'react-icons/fi';
import { FaCheckCircle } from 'react-icons/fa';
import Modal from '@/app/ui/overlays/Modal';
import { DispensaryRecord, DispensaryItem } from '@/app/features/inventory/pages/Inventory/types';
import {
  dispensePrescription,
  notDispensedPrescription,
} from '@/app/features/appointments/services/prescriptionWorkflowService';
import { fetchPrescriptionLabelPdf } from '@/app/features/inventory/services/dispensaryService';

type Props = {
  record: DispensaryRecord;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  organisationId: string;
  onActionComplete: () => void;
};

const calcTotalUnits = (item: DispensaryItem): number => {
  if (item.doseQty != null && item.frequencyPerDay != null && item.durationDays != null) {
    return item.doseQty * item.frequencyPerDay * item.durationDays;
  }
  return item.quantity;
};

const calcPacks = (totalUnits: number, stockUnitQty?: number): number | null => {
  if (!stockUnitQty || stockUnitQty <= 0) return null;
  return Math.ceil(totalUnits / stockUnitQty);
};

const pluralizeUnit = (unit: string, count: number): string => {
  if (!unit) return count === 1 ? 'unit' : 'units';
  const lower = unit.toLowerCase();
  if (count === 1) return lower;
  if (['ml', 'l', 'mg', 'g', 'mcg', 'iu'].includes(lower)) return lower;
  return lower.endsWith('s') ? lower : `${lower}s`;
};

const DispensaryDetailModal = ({
  record,
  showModal,
  setShowModal,
  organisationId,
  onActionComplete,
}: Props) => {
  const isDispensed = record.status === 'DISPENSED';
  const isPending = record.status === 'PENDING';
  const items = record.items ?? [];
  const [actioning, setActioning] = useState(false);
  const [printing, setPrinting] = useState(false);

  const ownerName = record.lead && record.lead !== '—' ? record.lead : null;
  const ownerLastName = ownerName ? ownerName.trim().split(/\s+/).at(-1) : null;
  const patientLine1 = ownerLastName
    ? `${record.patient.name} • ${ownerLastName}`
    : record.patient.name;

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

  const handlePrintLabel = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const blob = await fetchPrescriptionLabelPdf(organisationId, record.prescriptionId);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) win.focus();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-card-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">
              {isDispensed ? 'Dispensed request' : 'Dispense request'}
            </h2>
            {isDispensed && (
              <FaCheckCircle size={20} className="text-[var(--color-success-600)] shrink-0" />
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowModal(false)}
            aria-label="Close"
            disabled={actioning}
            className="inline-flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-card-hover transition-colors disabled:opacity-40"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto pt-5 pr-1">
          {/* Patient info */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-body-3-emphasis text-text-primary truncate">{patientLine1}</div>
              {ownerName && (
                <div className="mt-0.5 text-body-4 text-text-secondary">{ownerName}</div>
              )}
            </div>
            {record.patient.appointmentId && record.patient.appointmentId !== '—' && (
              <div className="shrink-0 text-right">
                <div className="text-caption-1 text-text-secondary">Appointment ID</div>
                <div className="text-body-4 font-semibold text-text-primary">
                  {record.patient.appointmentId}
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          {items.length > 0 ? (
            <div className="flex flex-col gap-4">
              {items.map((item, idx) => {
                const totalUnits = calcTotalUnits(item);
                const packs = calcPacks(totalUnits, item.stockUnitQty);
                const doseUnit = item.doseUnit ?? '';
                const stockUnit = item.stockUnitType ?? '';
                const hasCalc =
                  item.doseQty != null && item.frequencyPerDay != null && item.durationDays != null;

                const dispenseSummary =
                  packs !== null && stockUnit
                    ? `${packs} ${pluralizeUnit(stockUnit, packs)}`
                    : `${totalUnits} ${pluralizeUnit(doseUnit, totalUnits)}`;

                return (
                  <div key={`${item.name}-${idx}`} className="flex flex-col gap-2">
                    {/* Item header row */}
                    <div className="flex items-center gap-2">
                      <span className="text-body-4 text-text-secondary shrink-0">{idx + 1}.</span>
                      <span className="flex-1 text-body-4 font-semibold text-text-primary truncate">
                        {item.name}
                      </span>
                      {item.isRx && (
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-blue-text text-white text-[10px] font-bold shrink-0">
                          Rx
                        </span>
                      )}
                      {item.isControlled && (
                        <span className="inline-flex items-center rounded-full border border-card-border px-2 py-0.5 text-caption-1 text-text-secondary shrink-0">
                          Controlled
                        </span>
                      )}
                      <span className="text-body-4 font-semibold text-blue-text shrink-0">
                        {dispenseSummary}
                      </span>
                    </div>

                    {/* Prescription + calculation card */}
                    <div className="rounded-xl border border-card-border bg-[var(--color-neutral-50,#f9fafb)] p-3 flex flex-col gap-3">
                      {/* Prescription row */}
                      <div>
                        <div className="text-caption-1 text-text-secondary mb-1.5">
                          Prescription:
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption-1">
                          {item.doseQty != null && (
                            <>
                              <span className="text-text-secondary">Qnt.</span>
                              <span className="text-text-primary font-medium">
                                {item.doseQty} {doseUnit}
                              </span>
                            </>
                          )}
                          {item.frequency && (
                            <>
                              <span className="text-text-secondary">Freq.</span>
                              <span className="text-text-primary font-medium">
                                {item.frequency}
                              </span>
                            </>
                          )}
                          {item.durationDays != null && (
                            <>
                              <span className="text-text-secondary">Duration</span>
                              <span className="text-text-primary font-medium">
                                {item.durationDays} days
                              </span>
                            </>
                          )}
                          <span className="text-text-secondary">Refill</span>
                          <span className="text-text-primary font-medium">
                            {item.refillsRemaining == null
                              ? '—'
                              : `${item.refillsRemaining} remaining`}
                          </span>
                        </div>
                      </div>

                      {/* Dispense calculation */}
                      {hasCalc && (
                        <div className="flex items-end justify-between gap-4 pt-2 border-t border-card-border">
                          <div className="min-w-0">
                            <div className="text-caption-1 text-text-secondary mb-1">
                              Dispense qnt. calculation:
                            </div>
                            <div className="text-caption-1 text-text-primary">
                              {item.doseQty} {doseUnit} x {item.frequencyPerDay}/day x{' '}
                              {item.durationDays} days ={' '}
                              <span className="font-bold">
                                {totalUnits} {pluralizeUnit(doseUnit, totalUnits)}
                              </span>
                            </div>
                          </div>
                          {packs !== null && (
                            <div className="text-right shrink-0">
                              {stockUnit && item.stockUnitQty && (
                                <div className="text-caption-1 text-text-secondary">
                                  1 {stockUnit.toLowerCase()} of {item.stockUnitQty} {doseUnit}
                                </div>
                              )}
                              <div className="text-caption-1">
                                <span className="text-text-secondary">To dispense: </span>
                                <span className="font-semibold text-[var(--color-success-600)]">
                                  {packs} {pluralizeUnit(stockUnit || 'unit', packs)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Fallback for items without enriched fields */}
                      {!hasCalc && item.prescription && !item.frequency && !item.durationDays && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption-1">
                          {item.prescription.freq && (
                            <>
                              <span className="text-text-secondary">Freq.</span>
                              <span className="text-text-primary">{item.prescription.freq}</span>
                            </>
                          )}
                          {item.prescription.duration && (
                            <>
                              <span className="text-text-secondary">Duration</span>
                              <span className="text-text-primary">
                                {item.prescription.duration}
                              </span>
                            </>
                          )}
                          {item.prescription.refill && (
                            <>
                              <span className="text-text-secondary">Refill</span>
                              <span className="text-text-primary">{item.prescription.refill}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
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
          {isDispensed && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePrintLabel}
                disabled={printing}
                aria-label="Label"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-text-primary bg-white px-5 text-body-4-emphasis text-text-primary hover:bg-card-hover transition-colors disabled:opacity-50"
              >
                <FiPrinter size={16} />
                <span>{printing ? 'Loading…' : 'Label'}</span>
              </button>
            </div>
          )}
          {isPending && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDispense}
                disabled={actioning}
                className="inline-flex h-11 items-center justify-center rounded-full bg-text-primary px-6 text-body-4-emphasis text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Dispense all ({items.length})
              </button>
              <button
                type="button"
                onClick={handleNotDispensed}
                disabled={actioning}
                className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-danger-600)] px-6 text-body-4-emphasis text-[var(--color-danger-600)] hover:bg-[var(--color-danger-100)] transition-colors disabled:opacity-50"
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
