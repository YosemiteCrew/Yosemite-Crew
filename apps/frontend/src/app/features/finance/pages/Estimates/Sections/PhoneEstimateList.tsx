'use client';
import React from 'react';
import Image from 'next/image';

import { formatMoneyPrecise } from '@/app/lib/money';
import { formatDisplayDate } from '@/app/lib/date';
import { getSafeImageUrl, type ImageType } from '@/app/lib/urls';
import { getAvatarPalette } from '@/app/features/companions/pages/Companions/companionsDirectory';
import EstimateStatusBadge from '@/app/features/finance/pages/Estimates/Sections/EstimateStatusBadge';
import type { Estimate } from '@/app/features/finance/types/estimate';
import type { EstimateCompanion } from '@/app/features/finance/pages/Estimates/Sections/EstimateList';

type PhoneEstimateListProps = {
  estimates: Estimate[];
  /** The open estimate, marked in the list the way the table marks its row. */
  activeEstimateId: string | null;
  onSelect: (estimate: Estimate) => void;
  /** Display details for a companion id, so a card is readable without a join. */
  companion: (patientId: string) => EstimateCompanion;
};

const CARD_SHADOW = 'shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]';

/** Shared with `EstimateList` for the same reason it is used there: a bare
 *  `toLocaleDateString` resolves against the renderer's locale and time zone,
 *  which differs between server and client and produces a hydration mismatch. */
const formatDate = (value: string | null): string => formatDisplayDate(value ?? undefined, '-');

const buildDateLine = (estimate: Estimate): string => {
  const created = formatDate(estimate.createdAt);
  const validUntil = formatDate(estimate.validUntil);
  if (validUntil === '-') return created;
  return `${created} · valid to ${validUntil}`;
};

type PhoneEstimateCardProps = {
  estimate: Estimate;
  companion: EstimateCompanion;
  isActive: boolean;
  onSelect: (estimate: Estimate) => void;
};

const PhoneEstimateCard = ({ estimate, companion, isActive, onSelect }: PhoneEstimateCardProps) => {
  const palette = getAvatarPalette(companion.name);
  const avatarSrc = getSafeImageUrl(
    companion.photoUrl,
    (companion.speciesCode as ImageType) ?? 'other'
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(estimate)}
      /* The same accessible name the table's eye button carries, so the label
         is one string across both breakpoints rather than two that drift. */
      aria-label={`Open the estimate for ${companion.name}`}
      className={`w-full text-left flex flex-col gap-[7px] rounded-2xl bg-[var(--screen)] px-3.5 py-3 border ${
        isActive ? 'border-[var(--blue)] bg-card-hover' : 'border-[var(--hairline)]'
      } ${CARD_SHADOW}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex size-[30px] shrink-0 overflow-hidden rounded-full"
            style={{ background: palette.bg }}
          >
            <Image
              src={avatarSrc}
              alt=""
              width={30}
              height={30}
              className="size-[30px] rounded-full object-cover"
            />
          </span>
          {/* Wraps rather than truncating. The table's cell clips this name and
              hands the full value to a `title` - a hover affordance, and this
              surface has no hover. Companion names are short enough that the
              clip rarely bites today (a 37-character name still fits the 230px
              this span gets), so this is closing the affordance gap rather than
              fixing a defect anyone has hit; a card can grow downwards, so
              there is no reason to depend on hover here at all. */}
          <span className="min-w-0 break-words text-[13.5px] font-bold text-[var(--ink)]">
            {companion.name}
          </span>
        </span>
        <EstimateStatusBadge status={estimate.status} />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-words text-[11.5px] text-[var(--ink-faint)]">
          {buildDateLine(estimate)}
        </span>
        {/* The column the phone table pushed off-screen: on an estimates list
            the amount is the field the screen exists to show. */}
        <span className="shrink-0 text-[14px] font-bold tabular-nums text-[var(--ink)]">
          {formatMoneyPrecise(estimate.total, estimate.currency)}
        </span>
      </span>
    </button>
  );
};

/**
 * The phone (< 768px) form of the estimates list.
 *
 * `Estimates` had no phone branch at all, so a phone rendered `EstimateList`'s
 * six-column table inside a 364px scroller: `Created`, `Valid until`, `Total`
 * and `Actions` all sat beyond the right edge, with no scrollbar or gradient
 * saying so. Finance's own phone branch links here, so the screen is a routine
 * phone destination rather than a URL someone has to type.
 *
 * Mirrors `PhoneInvoiceList`'s card so the two finance lists read as one
 * product at this width.
 */
const PhoneEstimateList = ({
  estimates,
  activeEstimateId,
  onSelect,
  companion,
}: PhoneEstimateListProps) => (
  <div className="flex flex-col gap-2.5 pb-1">
    {estimates.map((estimate) => (
      <PhoneEstimateCard
        key={estimate.id}
        estimate={estimate}
        companion={companion(estimate.patientId)}
        isActive={estimate.id === activeEstimateId}
        onSelect={onSelect}
      />
    ))}
  </div>
);

export default PhoneEstimateList;
