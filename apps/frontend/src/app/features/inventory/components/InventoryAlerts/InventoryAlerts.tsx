'use client';
import React from 'react';
import clsx from 'clsx';
import { IoAlertCircleOutline, IoTimeOutline } from 'react-icons/io5';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import type {
  ExpiringAlertBatch,
  LowStockAlertItem,
} from '@/app/features/inventory/services/inventoryAlertsService';

export type InventoryAlertsProps = {
  lowStock: LowStockAlertItem[];
  expiring: ExpiringAlertBatch[];
  loading?: boolean;
  error?: string | null;
  /** Window used for the "Nothing expiring in the next N days" empty copy. Default 30. */
  expiringWindowDays?: number;
};

const DAY_MS = 86_400_000;
const RELATIVE_DAY_FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Midnight-anchored day delta, so "in 1 day" flips on the calendar boundary, not at a
 *  clock-time 24h from now — a batch expiring later today should read "today", not "tomorrow". */
const dayDelta = (target: Date, now: Date): number => {
  const t = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const n = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t - n) / DAY_MS);
};

const relativeDays = (delta: number): string => RELATIVE_DAY_FORMATTER.format(delta, 'day');

const absoluteDate = (date: Date): string => ABSOLUTE_DATE_FORMATTER.format(date);

const cardClass =
  'flex flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03)]';
const rowClass = 'flex items-center justify-between gap-3 px-4 py-3';
const titleClass = 'text-[13px] font-bold text-[var(--ink)]';
const metaClass = 'text-[11.5px] text-[var(--ink-faint)]';

type AlertCardProps = {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
};

const AlertCard = ({ icon, title, count, children }: AlertCardProps) => {
  const headingId = `inventory-alerts-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section className={cardClass} aria-labelledby={headingId}>
      <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
        <span className="text-[var(--ink-muted)]" aria-hidden="true">
          {icon}
        </span>
        <h3 id={headingId} className="text-[13.5px] font-bold text-[var(--ink)]">
          {title}
        </h3>
        {count > 0 && (
          <StatusPill label={String(count)} tone="neutral" className="ml-auto tabular-nums" />
        )}
      </header>
      {children}
    </section>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <p className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-faint)]">{message}</p>
);

const LoadingRows = () => (
  <ul className="divide-y divide-[var(--divider)]" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className={rowClass}>
        <span className="h-3.5 w-40 rounded bg-[var(--inset)]" />
        <span className="h-5 w-16 rounded-full bg-[var(--inset)]" />
      </li>
    ))}
  </ul>
);

const LowStockRow = ({ item }: { item: LowStockAlertItem }) => {
  const out = (item.onHand ?? 0) <= 0;
  const unit = item.unitOfMeasure || item.stockUnitType || '';
  return (
    <li className={rowClass}>
      <span className="min-w-0">
        <span className={clsx(titleClass, 'block truncate')}>{item.name}</span>
        <span className={clsx(metaClass, 'block')}>
          {item.category ? `${item.category} · ` : ''}
          {item.sku ?? ''}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        <span
          className={clsx(
            'text-[12.5px] font-bold tabular-nums',
            out ? 'text-[var(--danger-text)]' : 'text-[var(--ink)]'
          )}
        >
          {item.onHand ?? 0} / {item.reorderLevel ?? 0}
          {unit ? <span className="font-semibold text-[var(--ink-faint)]"> {unit}</span> : null}
        </span>
        <StatusPill label={out ? 'Out of stock' : 'Low'} tone={out ? 'danger' : 'warning'} />
      </span>
    </li>
  );
};

const ExpiringRow = ({ batch, now }: { batch: ExpiringAlertBatch; now: Date }) => {
  const label = batch.inventoryItem?.name || batch.batchNumber || 'Batch';
  const parsed = batch.expiryDate ? new Date(batch.expiryDate) : null;
  const valid = parsed !== null && !Number.isNaN(parsed.getTime());
  const delta = valid ? dayDelta(parsed, now) : null;
  const expired = delta !== null && delta < 0;
  return (
    <li className={rowClass}>
      <span className="min-w-0">
        <span className={clsx(titleClass, 'block truncate')}>{label}</span>
        <span className={clsx(metaClass, 'block')}>
          {batch.batchNumber ? `Batch ${batch.batchNumber} · ` : ''}
          Qty <span className="tabular-nums">{batch.quantity ?? 0}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill
          label={valid ? relativeDays(delta as number) : 'No expiry date'}
          tone={expired ? 'danger' : 'warning'}
        />
        {valid && <span className={metaClass}>{absoluteDate(parsed as Date)}</span>}
      </span>
    </li>
  );
};

/**
 * Presentational-only inventory alerts. Renders two grouped lists — low stock and
 * expiring soon — from arrays the caller supplies; it never fetches. The container
 * (`InventoryAlertsPanel`) owns loading, error and data.
 */
const InventoryAlerts = ({
  lowStock,
  expiring,
  loading = false,
  error = null,
  expiringWindowDays = 30,
}: InventoryAlertsProps) => {
  // `now` is captured once per render so every row in a pass agrees on "today".
  // Fresh each render so relative day labels never go stale; one value per
  // pass, so every row in a render still agrees on "today".
  const now = new Date();

  const lowStockBody = (() => {
    if (loading) return <LoadingRows />;
    if (lowStock.length === 0) return <EmptyState message="No low-stock items" />;
    return (
      <ul className="divide-y divide-[var(--divider)]">
        {lowStock.map((item) => (
          <LowStockRow key={item.id} item={item} />
        ))}
      </ul>
    );
  })();

  const expiringBody = (() => {
    if (loading) return <LoadingRows />;
    if (expiring.length === 0) {
      return <EmptyState message={`Nothing expiring in the next ${expiringWindowDays} days`} />;
    }
    return (
      <ul className="divide-y divide-[var(--divider)]">
        {expiring.map((batch) => (
          <ExpiringRow key={batch.id} batch={batch} now={now} />
        ))}
      </ul>
    );
  })();

  return (
    <div className="flex w-full flex-col gap-3">
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-[var(--divider)] bg-[var(--inset)] px-4 py-3 text-[12.5px] font-semibold text-[var(--danger-text)]"
        >
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AlertCard
          icon={<IoAlertCircleOutline size={18} />}
          title="Low stock"
          count={loading ? 0 : lowStock.length}
        >
          {lowStockBody}
        </AlertCard>
        <AlertCard
          icon={<IoTimeOutline size={18} />}
          title="Expiring soon"
          count={loading ? 0 : expiring.length}
        >
          {expiringBody}
        </AlertCard>
      </div>
    </div>
  );
};

export default InventoryAlerts;
