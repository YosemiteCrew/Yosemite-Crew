import React from 'react';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import type { InvoiceLineItem } from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';

type PackageBreakdownTooltipProps = {
  item: InvoiceLineItem;
  currency: string;
};

const formatCents = (cents: number, currency = 'USD'): string => formatMoney(cents / 100, currency);

const formatPercent = (value: number): number => Number(value.toFixed(2));

const PackageBreakdownTooltip = ({ item, currency }: PackageBreakdownTooltipProps) => {
  const breakdown = item.breakdown ?? [];
  if (breakdown.length === 0) return null;
  const breakdownTotalCents = breakdown.reduce((sum, row) => sum + row.amountCents, 0);
  const packageDiscountCents = item.discountCents;
  const packageDiscountPercent =
    item.grossCents > 0 ? (packageDiscountCents / item.grossCents) * 100 : 0;
  const packageTotalCents = Math.max(0, breakdownTotalCents - packageDiscountCents);

  return (
    <GlassTooltip
      content={
        <div className="flex min-w-130 flex-col gap-3 text-left">
          <div className="flex flex-col gap-0.5">
            <span className="text-caption-1 font-semibold text-neutral-0">{item.name}</span>
            <span className="text-caption-2 text-neutral-200">Package breakdown</span>
          </div>
          <table className="w-full border-collapse text-caption-2">
            <thead>
              <tr className="border-b border-neutral-0/20 text-neutral-200">
                <th className="w-8 px-2 py-1 text-left font-medium">#</th>
                <th className="px-2 py-1 text-left font-medium">Item</th>
                <th className="px-2 py-1 text-left font-medium">Type</th>
                <th className="px-2 py-1 text-right font-medium">Unit</th>
                <th className="px-2 py-1 text-center font-medium">Qty</th>
                <th className="px-2 py-1 text-right font-medium">Default disc.</th>
                <th className="px-2 py-1 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row, index) => (
                <tr key={row.id} className="border-b border-neutral-0/10 last:border-b-0">
                  <td className="px-2 py-1.5 text-neutral-300">{index + 1}.</td>
                  <td className="max-w-44 px-2 py-1.5 font-medium text-neutral-0">
                    <span className="block truncate">{row.name}</span>
                  </td>
                  <td className="px-2 py-1.5 text-neutral-200">{row.instructions ?? '-'}</td>
                  <td className="px-2 py-1.5 text-right text-neutral-0">
                    {formatCents(row.unitPriceCents ?? row.amountCents, currency)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-neutral-0">x{row.qty}</td>
                  <td className="px-2 py-1.5 text-right text-neutral-200">
                    {row.discountPercent != null && row.discountPercent > 0
                      ? `${formatPercent(row.discountPercent)}% / -${formatCents(
                          row.discountCents ?? 0,
                          currency
                        )}`
                      : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-neutral-0">
                    {formatCents(row.amountCents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-0/25">
                <td colSpan={6} className="px-2 pt-2 text-right font-medium text-neutral-200">
                  Component total
                </td>
                <td className="px-2 pt-2 text-right font-semibold text-neutral-0">
                  {formatCents(breakdownTotalCents, currency)}
                </td>
              </tr>
              {packageDiscountCents > 0 && (
                <tr>
                  <td colSpan={6} className="px-2 pt-1 text-right font-medium text-neutral-200">
                    Package discount ({formatPercent(packageDiscountPercent)}%)
                  </td>
                  <td className="px-2 pt-1 text-right font-medium text-neutral-0">
                    -{formatCents(packageDiscountCents, currency)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-neutral-0/25">
                <td colSpan={6} className="px-2 pt-2 text-right font-medium text-neutral-200">
                  Total
                </td>
                <td className="px-2 pt-2 text-right font-semibold text-neutral-0">
                  {formatCents(packageTotalCents, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      }
      side="bottom"
      maxWidth={560}
    >
      <button
        type="button"
        aria-label={`View ${item.name} package breakdown`}
        className="inline-flex size-4 shrink-0 translate-y-px items-center justify-center text-text-secondary transition-colors hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        <AiOutlineInfoCircle aria-hidden="true" size={14} />
      </button>
    </GlassTooltip>
  );
};

export default PackageBreakdownTooltip;
