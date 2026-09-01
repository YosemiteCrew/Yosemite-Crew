'use client';
import React from 'react';
import clsx from 'clsx';
import { formatMoneyPrecise } from '@/app/lib/money';
import { formatDisplayDate } from '@/app/lib/date';
import EstimateStatusBadge from '@/app/features/finance/pages/Estimates/Sections/EstimateStatusBadge';
import type { Estimate } from '@/app/features/finance/types/estimate';

type EstimateListProps = {
  estimates: Estimate[];
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
 * The estimates list. A table on desktop and stacked cards on phone, matching
 * how the invoice list splits, so the finance area reads consistently.
 */
const EstimateList = ({
  estimates,
  activeEstimateId,
  onSelect,
  companionName,
}: EstimateListProps) => (
  <div className="border border-card-border rounded-2xl overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full min-w-160 border-collapse">
        <caption className="sr-only">Estimates for this organisation</caption>
        <thead>
          <tr className="border-b border-b-card-border bg-card-hover">
            <th scope="col" className="text-left text-body-4 text-text-secondary px-4! py-3!">
              Companion
            </th>
            <th scope="col" className="text-left text-body-4 text-text-secondary px-4! py-3!">
              Status
            </th>
            <th scope="col" className="text-left text-body-4 text-text-secondary px-4! py-3!">
              Created
            </th>
            <th scope="col" className="text-left text-body-4 text-text-secondary px-4! py-3!">
              Valid until
            </th>
            <th scope="col" className="text-right text-body-4 text-text-secondary px-4! py-3!">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((estimate) => (
            <tr
              key={estimate.id}
              className={clsx(
                'border-b border-b-card-border last:border-b-0 cursor-pointer hover:bg-card-hover transition-colors',
                estimate.id === activeEstimateId && 'bg-card-hover'
              )}
            >
              <td className="px-4! py-3!">
                <button
                  type="button"
                  onClick={() => onSelect(estimate)}
                  className="text-body-3 text-text-primary text-left underline-offset-2 hover:underline"
                  aria-label={`Open the estimate for ${companionName(estimate.patientId)}`}
                >
                  {companionName(estimate.patientId)}
                </button>
              </td>
              <td className="px-4! py-3!">
                <EstimateStatusBadge status={estimate.status} />
              </td>
              <td className="px-4! py-3! text-body-4 text-text-secondary">
                {formatDate(estimate.createdAt)}
              </td>
              <td className="px-4! py-3! text-body-4 text-text-secondary">
                {formatDate(estimate.validUntil)}
              </td>
              <td className="px-4! py-3! text-body-3 text-text-primary text-right">
                {formatMoneyPrecise(estimate.total, estimate.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default EstimateList;
