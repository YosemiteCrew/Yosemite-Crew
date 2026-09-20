'use client';
import React, { useMemo } from 'react';
import Image from 'next/image';
import { IoEyeOutline } from 'react-icons/io5';
import { formatMoneyPrecise } from '@/app/lib/money';
import { formatDisplayDate } from '@/app/lib/date';
import { getSafeImageUrl, type ImageType } from '@/app/lib/urls';
import { getAvatarPalette } from '@/app/features/companions/pages/Companions/companionsDirectory';
import GenericTable, { type Column } from '@/app/ui/tables/GenericTable/GenericTable';
import EstimateStatusBadge from '@/app/features/finance/pages/Estimates/Sections/EstimateStatusBadge';
import type { Estimate } from '@/app/features/finance/types/estimate';

/** What a row needs to draw a companion, resolved by the page from its store. */
export type EstimateCompanion = {
  name: string;
  photoUrl?: string;
  speciesCode?: string;
};

type EstimateListProps = {
  estimates: Estimate[];
  /** The open estimate, highlighted in the list. */
  activeEstimateId: string | null;
  onSelect: (estimate: Estimate) => void;
  /** Display details for a companion id, so the list is readable without a join. */
  companion: (patientId: string) => EstimateCompanion;
};

/**
 * Dates go through the shared helper rather than `toLocaleDateString`, which
 * resolves against whatever locale and time zone the renderer happens to be in.
 * On a server-rendered route that differs between server and client and
 * produces a hydration mismatch.
 */
const formatDate = (value: string | null): string => formatDisplayDate(value ?? undefined, '-');

/**
 * The same identity cell the invoice table draws: a species-tinted disc behind
 * the companion's photo, the name, and a quiet second line. Estimates sat
 * beside Finance showing a bare text link, which made the two tables read as
 * different products.
 */
const CompanionCell = ({ companion }: { companion: EstimateCompanion }) => {
  const palette = getAvatarPalette(companion.name);
  const avatarSrc = getSafeImageUrl(
    companion.photoUrl,
    (companion.speciesCode as ImageType) ?? 'other'
  );
  return (
    <div className="flex items-center gap-2.5">
      <div
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
      </div>
      <span className="min-w-0 truncate text-body-3 text-text-primary" title={companion.name}>
        {companion.name}
      </span>
    </div>
  );
};

/**
 * The estimates list, rendered through the shared `GenericTable` so it inherits
 * the app's column-header typography, contrast, sticky behaviour and pager
 * rather than maintaining a second finance table of its own.
 */
const EstimateList = ({ estimates, activeEstimateId, onSelect, companion }: EstimateListProps) => {
  const columns = useMemo<Column<Estimate>[]>(
    () => [
      {
        key: 'patientId',
        label: 'Companion',
        render: (estimate) => <CompanionCell companion={companion(estimate.patientId)} />,
      },
      {
        key: 'status',
        label: 'Status',
        render: (estimate) => <EstimateStatusBadge status={estimate.status} />,
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (estimate) => (
          <span className="text-text-secondary">{formatDate(estimate.createdAt)}</span>
        ),
      },
      {
        key: 'validUntil',
        label: 'Valid until',
        render: (estimate) => (
          <span className="text-text-secondary">{formatDate(estimate.validUntil)}</span>
        ),
      },
      {
        // Money reads down the column, so it is right-aligned and weighted the
        // way the invoice table's TOTAL is.
        key: 'total',
        label: 'Total',
        render: (estimate) => (
          <span className="block text-right font-bold tabular-nums text-text-primary">
            {formatMoneyPrecise(estimate.total, estimate.currency)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (estimate) => (
          <button
            type="button"
            onClick={() => onSelect(estimate)}
            className="grid-row-action flex size-[30px] items-center justify-center rounded-full! border cursor-pointer transition-colors hover:bg-card-hover"
            aria-label={`Open the estimate for ${companion(estimate.patientId).name}`}
          >
            <IoEyeOutline size={14} aria-hidden="true" />
          </button>
        ),
      },
    ],
    [onSelect, companion]
  );

  return (
    <GenericTable
      data={estimates}
      columns={columns}
      caption="Estimates for this organisation"
      itemNoun="estimates"
      pagination
      // Kept through GenericTable's row hook rather than dropped: without it
      // the detail panel below can belong to any row on screen.
      rowClassName={(estimate) => (estimate.id === activeEstimateId ? 'bg-card-hover' : '')}
    />
  );
};

export default EstimateList;
