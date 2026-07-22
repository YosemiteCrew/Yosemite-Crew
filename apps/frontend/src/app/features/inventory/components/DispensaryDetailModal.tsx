'use client';
import React, { useState } from 'react';
import { IoCheckmarkCircle, IoPrintOutline } from 'react-icons/io5';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { DispensaryRecord, DispensaryItem } from '@/app/features/inventory/pages/Inventory/types';
import {
  dispensePrescription,
  notDispensedPrescription,
} from '@/app/features/appointments/services/prescriptionWorkflowService';
import { fetchPrescriptionLabelPdf } from '@/app/features/inventory/services/dispensaryService';

type Props = {
  record: DispensaryRecord | null;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  organisationId: string;
  onActionComplete: () => void;
};

const parseFrequencyPerDay = (frequency?: string): number | null => {
  if (!frequency) return null;
  const f = frequency.toLowerCase();
  if (f.includes('sid') || (f.includes('once') && !f.includes('weekly'))) return 1;
  if (f.includes('bid') || f.includes('twice')) return 2;
  if (f.includes('tid') || f.includes('three times') || f.includes('thrice')) return 3;
  if (f.includes('qid') || f.includes('four times')) return 4;
  if (f.includes('every 4 hour')) return 6;
  if (f.includes('every 6 hour') || f.includes('q6h')) return 4;
  if (f.includes('every 8 hour') || f.includes('q8h')) return 3;
  if (f.includes('every 12 hour') || f.includes('q12h')) return 2;
  if (f.includes('once weekly') || f.includes('weekly')) return 1 / 7;
  if (f.includes('before meals') || f.includes('after meals')) return 3;
  return null;
};

const toDays = (value: number, unit?: string): number => {
  const u = (unit ?? 'days').toLowerCase();
  if (u === 'weeks' || u === 'week') return value * 7;
  if (u === 'months' || u === 'month') return value * 30;
  return value;
};

const calcTotalUnits = (item: DispensaryItem, freqPerDay: number | null): number => {
  if (freqPerDay != null && item.durationDays != null) {
    return item.quantity * freqPerDay * toDays(item.durationDays, item.durationUnit);
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

const getDispensaryItemKey = (item: DispensaryItem): string =>
  [
    item.name,
    item.quantity,
    item.priceCents,
    item.doseQty ?? '',
    item.doseUnit ?? '',
    item.frequency ?? '',
    item.durationDays ?? '',
    item.durationUnit ?? '',
    item.stockUnitQty ?? '',
    item.stockUnitType ?? '',
  ].join('|');

type DispensaryItemRowProps = {
  item: DispensaryItem;
  idx: number;
};

const DispensaryItemRow = ({ item, idx }: Readonly<DispensaryItemRowProps>) => {
  const effectiveFreqPerDay = item.frequencyPerDay ?? parseFrequencyPerDay(item.frequency);
  const totalUnits = calcTotalUnits(item, effectiveFreqPerDay);
  const packs = calcPacks(totalUnits, item.stockUnitQty);
  const doseUnit = item.doseUnit ?? '';
  const stockUnit = item.stockUnitType ?? '';
  const hasCalc = effectiveFreqPerDay != null && item.durationDays != null;

  const dispenseSummary =
    packs !== null && stockUnit
      ? `${packs} ${pluralizeUnit(stockUnit, packs)}`
      : `${totalUnits} ${pluralizeUnit(stockUnit || 'unit', totalUnits)}`;

  return (
    <div className="flex flex-col gap-2">
      {/* Item header row */}
      <div className="flex items-center gap-2">
        <span className="text-body-4 text-text-secondary shrink-0">{idx + 1}.</span>
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="text-body-4 font-semibold text-text-primary truncate">{item.name}</span>
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
        </div>
        <span className="text-body-4 font-semibold text-blue-text shrink-0">{dispenseSummary}</span>
      </div>

      {/* Prescription + calculation card */}
      <div className="rounded-xl border border-card-border bg-[var(--screen-2)] p-3 flex flex-col gap-3">
        {/* Prescription row */}
        <div>
          <div className="text-caption-1 text-text-secondary mb-1.5">Prescription:</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption-1">
            <span className="text-text-secondary">Qnt.</span>
            <span className="text-text-primary font-medium">{item.quantity}</span>
            {item.frequency && (
              <>
                <span className="text-text-secondary">Freq.</span>
                <span className="text-text-primary font-medium">{item.frequency}</span>
              </>
            )}
            {item.durationDays != null && (
              <>
                <span className="text-text-secondary">Duration</span>
                <span className="text-text-primary font-medium">
                  {item.durationDays} {item.durationUnit ?? 'days'}
                </span>
              </>
            )}
            <span className="text-text-secondary">Refill</span>
            <span className="text-text-primary font-medium">
              {item.refillsRemaining == null ? '—' : `${item.refillsRemaining} remaining`}
            </span>
          </div>
        </div>

        {/* Dispense calculation */}
        {hasCalc && (
          <div className="flex items-end justify-between gap-4 pt-2">
            <div className="min-w-0">
              <div className="text-caption-1 text-text-secondary mb-1">
                Dispense qnt. calculation:
              </div>
              <div className="text-caption-1 text-text-primary">
                {effectiveFreqPerDay! < 1 ? (
                  <>
                    {item.quantity} x {item.durationDays} {item.durationUnit ?? 'days'} (
                    {item.frequency}) ={' '}
                    <span className="font-bold">
                      {Math.ceil(totalUnits)}{' '}
                      {pluralizeUnit(doseUnit || 'unit', Math.ceil(totalUnits))}
                    </span>
                  </>
                ) : (
                  <>
                    {item.quantity} x {Number(effectiveFreqPerDay!.toFixed(2))}/day x{' '}
                    {item.durationDays} {item.durationUnit ?? 'days'} ={' '}
                    <span className="font-bold">
                      {Number(totalUnits.toFixed(2))}{' '}
                      {pluralizeUnit(doseUnit || 'unit', totalUnits)}
                    </span>
                  </>
                )}
              </div>
            </div>
            {packs !== null && (
              <div className="text-right shrink-0">
                {stockUnit && item.stockUnitQty && (
                  <div className="text-caption-1 text-text-secondary">
                    1 {stockUnit.toLowerCase()} of {item.stockUnitQty} {doseUnit || 'units'}
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
                <span className="text-text-primary">{item.prescription.duration}</span>
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
};

const DispensaryDetailModal = ({
  record,
  showModal,
  setShowModal,
  organisationId,
  onActionComplete,
}: Props) => {
  const [actioning, setActioning] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (!record) return null;
  const isDispensed = record.status === 'DISPENSED';
  const isPending = record.status === 'PENDING';
  const items = record.items ?? [];

  const ownerName = record.petParentName || null;
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

  const handleClose = () => {
    if (actioning) return;
    setShowModal(false);
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} size="md">
      <div className="flex h-full flex-col gap-6 overflow-hidden">
        <ModalHeader
          eyebrow={isDispensed ? 'Dispensed request' : 'Dispense request'}
          title={patientLine1}
          meta={ownerName}
          onClose={handleClose}
          isCloseDisabled={actioning}
          actions={
            isDispensed && (
              <IoCheckmarkCircle size={20} className="text-[var(--success)] shrink-0" />
            )
          }
        />

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
          {record.patient.appointmentId && record.patient.appointmentId !== '—' && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-caption-1 text-text-secondary">Appointment ID</span>
              <span className="text-body-4 font-semibold text-text-primary">
                {record.patient.appointmentId}
              </span>
            </div>
          )}

          {/* Items */}
          {items.length > 0 ? (
            <div className="flex flex-col gap-4">
              {items.map((item, idx) => (
                <DispensaryItemRow key={getDispensaryItemKey(item)} item={item} idx={idx} />
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-body-4 text-text-secondary">
              No items recorded
            </div>
          )}
        </div>

        {isDispensed && (
          <ModalFooter>
            <Secondary
              href="#"
              text={printing ? 'Loading…' : 'Label'}
              ariaLabel="Label"
              icon={<IoPrintOutline />}
              onClick={handlePrintLabel}
              isDisabled={printing}
              size="large"
            />
          </ModalFooter>
        )}
        {isPending && (
          <ModalFooter align="stretch">
            <Primary
              href="#"
              text={actioning ? 'Dispensing…' : `Dispense all (${items.length})`}
              onClick={handleDispense}
              isDisabled={actioning}
            />
            <Secondary
              href="#"
              text="Not dispensed"
              onClick={handleNotDispensed}
              isDisabled={actioning}
            />
          </ModalFooter>
        )}
      </div>
    </Modal>
  );
};

export default DispensaryDetailModal;
