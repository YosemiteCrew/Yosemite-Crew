import React from 'react';
import { PackageBreakdownItem } from '@/app/features/organization/types/revamp';
import { computePackageBreakdownItem } from '@/app/features/organization/services/catalogCalculations';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import { IoInformationCircleOutline, IoTrash } from 'react-icons/io5';

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure',
  LAB: 'Diagnostics',
  INVENTORY: 'Inventory',
  MEDICATION: 'Medication',
  PACKAGE: 'Package',
};

type PackageBreakdownTableProps = {
  items: PackageBreakdownItem[];
  additionalDiscount: number;
  editable?: boolean;
  onRemoveItem?: (id: string) => void;
  onChangeQty?: (id: string, qty: number) => void;
  onChangeDiscount?: (id: string, discount: number) => void;
};

const NestedBreakdownTooltip = ({
  items,
  additionalDiscount,
}: {
  items: PackageBreakdownItem[];
  additionalDiscount: number;
}) => {
  const orgCurrency = useCurrencyForPrimaryOrg();
  const subtotal = items.reduce((sum, item) => {
    const { net } = computePackageBreakdownItem(item);
    return sum + net;
  }, 0);
  const afterAdditional = subtotal - (subtotal * additionalDiscount) / 100;

  return (
    <div style={{ minWidth: 360 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--ink-muted)' }}>
            <th style={{ textAlign: 'left', padding: '2px 6px' }}>#</th>
            <th style={{ textAlign: 'left', padding: '2px 6px' }}>Type</th>
            <th style={{ textAlign: 'left', padding: '2px 6px' }}>Name</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>Unit</th>
            <th style={{ textAlign: 'center', padding: '2px 6px' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>Disc.</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>Net</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const { net } = computePackageBreakdownItem(item);
            return (
              <tr key={item.id} style={{ borderTop: '1px solid var(--hairline)' }}>
                <td style={{ padding: '3px 6px', color: 'var(--ink-muted)' }}>{i + 1}.</td>
                <td style={{ padding: '3px 6px', color: 'var(--ink-muted)' }}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </td>
                <td style={{ padding: '3px 6px' }}>{item.name}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                  {formatMoney(item.unitPrice, item.currency ?? orgCurrency)}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>×{item.quantity}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--ink-muted)' }}>
                  {item.discount}%
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                  {formatMoney(net, item.currency ?? orgCurrency)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {additionalDiscount > 0 && (
            <tr style={{ borderTop: '1px solid var(--hairline-hover)' }}>
              <td
                colSpan={6}
                style={{
                  padding: '3px 6px',
                  textAlign: 'right',
                  color: 'var(--ink-muted)',
                  fontSize: 12,
                }}
              >
                Additional discount ({additionalDiscount}%)
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--ink-muted)' }}>
                - {formatMoney((subtotal * additionalDiscount) / 100, orgCurrency)}
              </td>
            </tr>
          )}
          <tr style={{ borderTop: '1px solid var(--hairline-hover)' }}>
            <td
              colSpan={6}
              style={{
                padding: '4px 6px',
                textAlign: 'right',
                color: 'var(--ink-muted)',
                fontSize: 12,
              }}
            >
              Total
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>
              {formatMoney(afterAdditional, orgCurrency)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const PackageBreakdownTable = ({
  items,
  additionalDiscount,
  editable = false,
  onRemoveItem,
  onChangeQty,
  onChangeDiscount,
}: PackageBreakdownTableProps) => {
  const orgCurrency = useCurrencyForPrimaryOrg();
  const afterItemDiscounts = items.reduce((sum, item) => {
    const { net } = computePackageBreakdownItem(item);
    return sum + net;
  }, 0);
  const additionalDiscountAmt = (afterItemDiscounts * additionalDiscount) / 100;
  const totalCost = afterItemDiscounts - additionalDiscountAmt;

  // `relative` on the scroller is load-bearing, not decoration. The editable header
  // carries an `sr-only` span, which is `position: absolute` with no offsets. An
  // absolutely positioned box is only clipped by a scroll container that sits in its
  // containing-block chain, and a bare `overflow-x-auto` div is not positioned - so
  // the span escaped this scroller, landed at the table's full 780px width and dragged
  // the whole DOCUMENT to 780px on a 390px phone. The table was contained the entire
  // time; one 1px hidden label was scrolling the page sideways.
  return (
    <div className="relative w-full overflow-x-auto -mx-1 px-1">
      <table className="min-w-full text-body-4 text-text-primary border-separate border-spacing-0">
        <colgroup>
          <col className="w-8" />
          <col className="w-28" />
          <col />
          <col className="w-28" />
          <col className="w-24" />
          <col className="w-28" />
          <col className="w-28" />
          <col className="w-28" />
          {editable && <col className="w-10" />}
        </colgroup>
        <thead>
          <tr className="text-caption-1 text-text-secondary border-b border-card-border">
            <th className="text-left p-3">#</th>
            <th className="text-left p-3">Type</th>
            <th className="text-left p-3">Name</th>
            <th className="text-right p-3 whitespace-nowrap">Unit price</th>
            <th className="text-center p-3">Qty.</th>
            <th className="text-right p-3 whitespace-nowrap">Gross amt.</th>
            <th className="text-right p-3 whitespace-nowrap">Discount %</th>
            <th className="text-right p-3">Amount</th>
            {editable && (
              <th className="p-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const { gross, net } = computePackageBreakdownItem(item);
            const isPackage = item.type === 'PACKAGE';
            const hasNested = isPackage && item.nestedBreakdown && item.nestedBreakdown.length > 0;
            return (
              <tr key={item.id} className="border-t border-card-border">
                <td className="p-3 text-text-secondary">{i + 1}.</td>
                <td className="p-3 text-text-secondary">{TYPE_LABELS[item.type] ?? item.type}</td>
                <td className="p-3">
                  <span className="flex items-center gap-1.5">
                    {item.name}
                    {hasNested && (
                      <GlassTooltip
                        content={
                          <NestedBreakdownTooltip
                            items={item.nestedBreakdown!}
                            additionalDiscount={0}
                          />
                        }
                        side="right"
                        maxWidth={440}
                      >
                        <span className="cursor-default text-text-secondary hover:text-text-brand transition-colors">
                          <IoInformationCircleOutline size={14} aria-hidden="true" />
                        </span>
                      </GlassTooltip>
                    )}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {formatMoney(item.unitPrice, item.currency ?? orgCurrency)}
                </td>
                <td className="p-3 text-center">
                  {editable ? (
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const v = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                        onChangeQty?.(item.id, v);
                      }}
                      className="w-20 text-center bg-transparent border border-input-border-default rounded-xl px-3 h-9 text-body-4 focus-visible:outline-none focus-visible:border-input-border-active"
                      aria-label={`Quantity for ${item.name}`}
                    />
                  ) : (
                    <span>×{item.quantity}</span>
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {formatMoney(gross, item.currency ?? orgCurrency)}
                </td>
                <td className="p-3 text-right">
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      max={item.maxDiscount ?? 100}
                      value={item.discount}
                      onChange={(e) => {
                        const raw = Number.parseFloat(e.target.value);
                        const max = item.maxDiscount ?? 100;
                        const v = Number.isNaN(raw) ? 0 : Math.min(max, Math.max(0, raw));
                        onChangeDiscount?.(item.id, v);
                      }}
                      className="w-24 text-right bg-transparent border border-input-border-default rounded-xl px-3 h-9 text-body-4 focus-visible:outline-none focus-visible:border-input-border-active"
                      aria-label={`Discount for ${item.name}`}
                    />
                  ) : (
                    <span>-{item.discount}%</span>
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {formatMoney(net, item.currency ?? orgCurrency)}
                </td>
                {editable && (
                  <td className="p-3">
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemoveItem?.(item.id)}
                      className="flex items-center justify-center size-7 rounded-full border border-transparent hover:border-danger-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600"
                    >
                      <IoTrash size={16} color="var(--color-danger-600)" aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {additionalDiscount > 0 && (
            <tr className="border-t border-card-border">
              <td colSpan={7} className="px-3 py-2 text-right text-caption-1 text-text-secondary">
                Additional Discount ({additionalDiscount}%)
              </td>
              <td
                colSpan={editable ? 2 : 1}
                className="px-3 py-2 text-right text-text-brand whitespace-nowrap"
              >
                - {formatMoney(additionalDiscountAmt, orgCurrency)}
              </td>
            </tr>
          )}
          <tr className="border-t border-card-border">
            <td
              colSpan={7}
              className="px-3 pt-3 pb-2 text-right text-caption-1 text-text-secondary"
            >
              Total cost
            </td>
            <td colSpan={editable ? 2 : 1} className="px-3 pt-3 pb-2 text-right">
              {editable ? (
                <span className="text-body-4-emphasis text-text-brand whitespace-nowrap">
                  {formatMoney(totalCost, orgCurrency)}
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-2 justify-end rounded-2xl bg-primary-100 px-4 py-2 text-body-3-emphasis text-text-brand whitespace-nowrap"
                  style={{ minWidth: 120, height: 40 }}
                >
                  {formatMoney(totalCost, orgCurrency)}
                </span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default PackageBreakdownTable;
