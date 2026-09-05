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

// Built from display fields alone, two identical prescription lines - or two
// lines differing only in a field not listed here - collide. React treats
// duplicate sibling keys as unsupported and may preserve, drop or duplicate rows
// while reconciling, so the list position disambiguates the content key.
const getDispensaryItemKey = (item: DispensaryItem, index: number): string =>
  [
    index,
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

/** Headline quantity: packs once a pack size is known, otherwise the raw total. */
const formatDispenseSummary = (
  packs: number | null,
  stockUnit: string,
  totalUnits: number
): string =>
  packs !== null && stockUnit
    ? `${packs} ${pluralizeUnit(stockUnit, packs)}`
    : `${totalUnits} ${pluralizeUnit(stockUnit || 'unit', totalUnits)}`;

/** Item header row: position, name, Rx/controlled flags and the dispense total. */
const DispensaryItemHeader = ({
  item,
  idx,
  dispenseSummary,
}: Readonly<{ item: DispensaryItem; idx: number; dispenseSummary: string }>) => (
  <div className="flex items-center gap-2">
    <span className="text-body-4 text-text-secondary shrink-0">{idx + 1}.</span>
    <div className="flex flex-1 items-center gap-2 min-w-0">
      <span className="text-body-4 font-semibold text-text-primary truncate">{item.name}</span>
      {item.isRx && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--blue-strong)] text-white text-[10px] font-bold shrink-0">
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
);

/** What was prescribed: quantity, frequency, duration and refills remaining. */
const PrescribedSummary = ({ item }: Readonly<{ item: DispensaryItem }>) => (
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
);

/** Right-hand column of the calculation: pack size and the rounded pack count. */
const DispensePackSummary = ({
  item,
  packs,
  doseUnit,
  stockUnit,
}: Readonly<{ item: DispensaryItem; packs: number; doseUnit: string; stockUnit: string }>) => (
  <div className="text-right shrink-0">
    {stockUnit && item.stockUnitQty && (
      <div className="text-caption-1 text-text-secondary">
        1 {stockUnit.toLowerCase()} of {item.stockUnitQty} {doseUnit || 'units'}
      </div>
    )}
    <div className="text-caption-1">
      <span className="text-text-secondary">To dispense: </span>
      <span className="font-semibold text-[var(--success-text)]">
        {packs} {pluralizeUnit(stockUnit || 'unit', packs)}
      </span>
    </div>
  </div>
);

/** How the dispense total was reached, shown when frequency and duration are known. */
const DispenseCalculation = ({
  item,
  freqPerDay,
  totalUnits,
  packs,
  doseUnit,
  stockUnit,
}: Readonly<{
  item: DispensaryItem;
  freqPerDay: number;
  totalUnits: number;
  packs: number | null;
  doseUnit: string;
  stockUnit: string;
}>) => (
  <div className="flex items-end justify-between gap-4 pt-2">
    <div className="min-w-0">
      <div className="text-caption-1 text-text-secondary mb-1">Dispense qnt. calculation:</div>
      <div className="text-caption-1 text-text-primary">
        {freqPerDay < 1 ? (
          <>
            {item.quantity} x {item.durationDays} {item.durationUnit ?? 'days'} ({item.frequency}) ={' '}
            <span className="font-bold">
              {Math.ceil(totalUnits)} {pluralizeUnit(doseUnit || 'unit', Math.ceil(totalUnits))}
            </span>
          </>
        ) : (
          <>
            {item.quantity} x {Number(freqPerDay.toFixed(2))}/day x {item.durationDays}{' '}
            {item.durationUnit ?? 'days'} ={' '}
            <span className="font-bold">
              {Number(totalUnits.toFixed(2))} {pluralizeUnit(doseUnit || 'unit', totalUnits)}
            </span>
          </>
        )}
      </div>
    </div>
    {packs !== null && (
      <DispensePackSummary item={item} packs={packs} doseUnit={doseUnit} stockUnit={stockUnit} />
    )}
  </div>
);

/**
 * Free-text prescription block for legacy records that carry no enriched
 * numeric fields. Dose and route are medication instructions a pharmacist reads
 * before dispensing; they must not be dropped just because this record lacks
 * the enriched numeric fields.
 */
const PrescriptionTextFallback = ({
  prescription,
}: Readonly<{ prescription: NonNullable<DispensaryItem['prescription']> }>) => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption-1">
    {prescription.dose && (
      <>
        <span className="text-text-secondary">Dose</span>
        <span className="text-text-primary">{prescription.dose}</span>
      </>
    )}
    {prescription.freq && (
      <>
        <span className="text-text-secondary">Freq.</span>
        <span className="text-text-primary">{prescription.freq}</span>
      </>
    )}
    {prescription.duration && (
      <>
        <span className="text-text-secondary">Duration</span>
        <span className="text-text-primary">{prescription.duration}</span>
      </>
    )}
    {prescription.route && (
      <>
        <span className="text-text-secondary">Route</span>
        <span className="text-text-primary">{prescription.route}</span>
      </>
    )}
    {prescription.refill && (
      <>
        <span className="text-text-secondary">Refill</span>
        <span className="text-text-primary">{prescription.refill}</span>
      </>
    )}
  </div>
);

const DispensaryItemRow = ({ item, idx }: Readonly<DispensaryItemRowProps>) => {
  const effectiveFreqPerDay = item.frequencyPerDay ?? parseFrequencyPerDay(item.frequency);
  const totalUnits = calcTotalUnits(item, effectiveFreqPerDay);
  const packs = calcPacks(totalUnits, item.stockUnitQty);
  const doseUnit = item.doseUnit ?? '';
  const stockUnit = item.stockUnitType ?? '';
  const hasCalc = effectiveFreqPerDay != null && item.durationDays != null;

  return (
    <div className="flex flex-col gap-2">
      {/* Item header row */}
      <DispensaryItemHeader
        item={item}
        idx={idx}
        dispenseSummary={formatDispenseSummary(packs, stockUnit, totalUnits)}
      />

      {/* Prescription + calculation card */}
      <div className="rounded-xl border border-card-border bg-[var(--screen-2)] p-3 flex flex-col gap-3">
        {/* Prescription row */}
        <PrescribedSummary item={item} />

        {/* Dispense calculation */}
        {hasCalc && (
          <DispenseCalculation
            item={item}
            freqPerDay={effectiveFreqPerDay!}
            totalUnits={totalUnits}
            packs={packs}
            doseUnit={doseUnit}
            stockUnit={stockUnit}
          />
        )}

        {/* Fallback for items without enriched fields */}
        {!hasCalc && item.prescription && !item.frequency && !item.durationDays && (
          <PrescriptionTextFallback prescription={item.prescription} />
        )}
      </div>
    </div>
  );
};

/**
 * Everything the panel *does*, kept out of what it renders: the two in-flight
 * flags, the queue actions and the label's object-URL lifecycle. Callable
 * before the panel's `record` guard, so it takes an id that may be empty.
 */
const useDispensaryActions = ({
  organisationId,
  prescriptionId,
  setShowModal,
  onActionComplete,
}: {
  organisationId: string;
  prescriptionId: string;
  setShowModal: (value: boolean) => void;
  onActionComplete: () => void;
}) => {
  const [actioning, setActioning] = useState(false);
  const [printing, setPrinting] = useState(false);

  /**
   * Dispensing and marking not-dispensed differ only in which endpoint they
   * call: both hold the panel open, close it on success and refresh the queue.
   */
  const runPrescriptionAction = async (
    action: (organisationId: string, prescriptionId: string) => Promise<unknown>
  ) => {
    if (actioning) return;
    setActioning(true);
    try {
      await action(organisationId, prescriptionId);
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
      const blob = await fetchPrescriptionLabelPdf(organisationId, prescriptionId);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) win.focus();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setPrinting(false);
    }
  };

  return {
    actioning,
    printing,
    handleDispense: () => runPrescriptionAction(dispensePrescription),
    handleNotDispensed: () => runPrescriptionAction(notDispensedPrescription),
    handlePrintLabel,
    // The panel must not be dismissed out from under an action in flight.
    handleClose: () => {
      if (actioning) return;
      setShowModal(false);
    },
  };
};

type DispensaryFooterProps = {
  isDispensed: boolean;
  isPending: boolean;
  itemCount: number;
  actions: ReturnType<typeof useDispensaryActions>;
};

const DispensaryFooter = ({
  isDispensed,
  isPending,
  itemCount,
  actions,
}: Readonly<DispensaryFooterProps>) => {
  if (isDispensed) {
    return (
      <ModalFooter>
        <Secondary
          href="#"
          text={actions.printing ? 'Loading…' : 'Label'}
          ariaLabel="Label"
          icon={<IoPrintOutline />}
          onClick={actions.handlePrintLabel}
          isDisabled={actions.printing}
          size="large"
        />
      </ModalFooter>
    );
  }

  if (!isPending) return null;

  return (
    <ModalFooter align="stretch">
      <Primary
        href="#"
        text={actions.actioning ? 'Dispensing…' : `Dispense all (${itemCount})`}
        onClick={actions.handleDispense}
        isDisabled={actions.actioning}
      />
      <Secondary
        href="#"
        text="Not dispensed"
        onClick={actions.handleNotDispensed}
        isDisabled={actions.actioning}
      />
    </ModalFooter>
  );
};

const DispensaryDetailModal = ({
  record,
  showModal,
  setShowModal,
  organisationId,
  onActionComplete,
}: Props) => {
  const actions = useDispensaryActions({
    organisationId,
    prescriptionId: record?.prescriptionId ?? '',
    setShowModal,
    onActionComplete,
  });

  if (!record) return null;
  const isDispensed = record.status === 'DISPENSED';
  const isPending = record.status === 'PENDING';
  const items = record.items ?? [];

  const ownerName = record.petParentName || null;
  const ownerLastName = ownerName ? ownerName.trim().split(/\s+/).at(-1) : null;
  const patientLine1 = ownerLastName
    ? `${record.patient.name} • ${ownerLastName}`
    : record.patient.name;

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} size="md">
      <div className="flex h-full flex-col gap-6 overflow-hidden">
        <ModalHeader
          eyebrow={isDispensed ? 'Dispensed request' : 'Dispense request'}
          title={patientLine1}
          meta={ownerName}
          onClose={actions.handleClose}
          isCloseDisabled={actions.actioning}
          actions={
            isDispensed && (
              <IoCheckmarkCircle size={20} className="text-[var(--success-text)] shrink-0" />
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
                <DispensaryItemRow key={getDispensaryItemKey(item, idx)} item={item} idx={idx} />
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-body-4 text-text-secondary">
              No items recorded
            </div>
          )}
        </div>

        <DispensaryFooter
          isDispensed={isDispensed}
          isPending={isPending}
          itemCount={items.length}
          actions={actions}
        />
      </div>
    </Modal>
  );
};

export default DispensaryDetailModal;
