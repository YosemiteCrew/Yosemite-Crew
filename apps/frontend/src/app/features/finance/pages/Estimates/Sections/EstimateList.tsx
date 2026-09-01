'use client';
import React, { useMemo } from 'react';
import { formatMoneyPrecise } from '@/app/lib/money';
import { formatDisplayDate } from '@/app/lib/date';
import GenericTable, { type Column } from '@/app/ui/tables/GenericTable/GenericTable';
import EstimateStatusBadge from '@/app/features/finance/pages/Estimates/Sections/EstimateStatusBadge';
import type { Estimate } from '@/app/features/finance/types/estimate';

type EstimateListProps = {
  estimates: Estimate[];
  /** The open estimate, highlighted in the list. */
  activeEstimateId: string | null;
  onSelect: (estimate: Estimate) => void;
  /** Display name for a companion id, so the list is readable without a join. */
  companionName: (patientId: string) => string;
};

/**
 * Dates go through the shared helper rather than `toLocaleDateString`, which
 * resolves against whatever locale and time zone the renderer happens to be in.
 * On a server-rendered route that differs between server and client and
 * produces a hydration mismatch.
 */
const formatDate = (value: string | null): string => formatDisplayDate(value ?? undefined, '-');

/**
 * The estimates list, rendered through the shared `GenericTable` so it inherits
 * the app's column-header typography, contrast, sticky behaviour and pager
 * rather than maintaining a second finance table of its own.
 */
const EstimateList = ({
  estimates,
  activeEstimateId,
  onSelect,
  companionName,
}: EstimateListProps) => {
  const columns = useMemo<Column<Estimate>[]>(
    () => [
      {
        key: 'patientId',
        label: 'Companion',
        render: (estimate) => (
          <button
            type="button"
            onClick={() => onSelect(estimate)}
            className="text-body-3 text-text-primary text-left underline-offset-2 hover:underline"
            aria-label={`Open the estimate for ${companionName(estimate.patientId)}`}
          >
            {companionName(estimate.patientId)}
          </button>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (estimate) => <EstimateStatusBadge status={estimate.status} />,
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (estimate) => formatDate(estimate.createdAt),
      },
      {
        key: 'validUntil',
        label: 'Valid until',
        render: (estimate) => formatDate(estimate.validUntil),
      },
      {
        key: 'total',
        label: 'Total',
        render: (estimate) => (
          <span className="tabular-nums">
            {formatMoneyPrecise(estimate.total, estimate.currency)}
          </span>
        ),
      },
    ],
    [onSelect, companionName]
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
