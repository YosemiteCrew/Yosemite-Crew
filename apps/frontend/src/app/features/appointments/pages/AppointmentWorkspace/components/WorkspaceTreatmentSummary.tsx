import React from 'react';
import { formatMoney } from '@/app/lib/money';

type WorkspaceTreatmentSummaryProps = {
  treatmentCount: number;
  treatmentCents: number;
  prescriptionCount: number;
  prescriptionCents: number;
  currency: string;
};

const money = (cents: number, currency: string) => formatMoney(cents / 100, currency);

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * Treatment step right-rail summary (design: the "Running total" panel). Shows the
 * gross of the treatment items and prescriptions being built and the count that will
 * carry into the invoice step, so the clinician sees the bill forming beside the
 * editors. Deposits/tax are applied on the invoice step, not here.
 */
const WorkspaceTreatmentSummary = ({
  treatmentCount,
  treatmentCents,
  prescriptionCount,
  prescriptionCents,
  currency,
}: WorkspaceTreatmentSummaryProps) => {
  const runningCents = treatmentCents + prescriptionCents;
  const carryParts: string[] = [];
  if (treatmentCount > 0) carryParts.push(pluralize(treatmentCount, 'treatment item'));
  if (prescriptionCount > 0) carryParts.push(pluralize(prescriptionCount, 'prescription'));
  const carryText =
    carryParts.length > 0
      ? `${carryParts.join(' + ')} will be carried to the invoice step.`
      : 'Add treatment items or prescriptions to build the invoice.';

  return (
    <div className="flex w-full flex-col gap-3">
      <section
        aria-label="Treatment summary"
        className="rounded-[14px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]"
      >
        <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
          <span className="text-body-4 text-text-secondary">Treatment items</span>
          <span className="text-body-4-emphasis tabular-nums text-text-primary">
            {treatmentCount} · {money(treatmentCents, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
          <span className="text-body-4 text-text-secondary">Prescriptions</span>
          <span className="text-body-4-emphasis tabular-nums text-text-primary">
            {prescriptionCount} · {money(prescriptionCents, currency)}
          </span>
        </div>
        <div className="flex items-baseline justify-between px-4 py-3.5">
          <span className="text-body-3-emphasis text-text-primary">Running total</span>
          <span className="text-[18px] font-bold tabular-nums text-text-primary">
            {money(runningCents, currency)}
          </span>
        </div>
      </section>
      <p className="px-1 text-caption-2 leading-relaxed text-text-tertiary">{carryText}</p>
    </div>
  );
};

export default WorkspaceTreatmentSummary;
