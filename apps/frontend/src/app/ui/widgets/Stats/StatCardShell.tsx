import React from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';

type StatCardShellProps = {
  title: string;
  options: readonly string[];
  /** Renders the shared bar-chart empty state instead of `children`. */
  isEmpty: boolean;
  /** Duration option shown in the header pill; defaults to the first option. */
  selected?: string;
  /** Forwarded to the header's duration picker; omit for a static pill. */
  onSelect?: (option: string) => void;
  /**
   * Card-surface classes that vary per card (min-height, gap, overflow).
   * Defaults to the fixed-height reading used by the inventory stats.
   */
  cardClassName?: string;
  children: React.ReactNode;
};

const StatCardShell = ({
  title,
  options,
  isEmpty,
  selected,
  onSelect,
  cardClassName = 'min-h-75 gap-2.5',
  children,
}: StatCardShellProps) => (
  <div className="flex flex-col gap-2">
    <CardHeader
      title={title}
      options={options}
      selected={selected ?? options[0]}
      onSelect={onSelect}
    />
    <div className={`flex w-full flex-col yc-card-surface px-5 py-4 ${cardClassName}`}>
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--ink-faint)]">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect x="4" y="24" width="8" height="12" rx="2" fill="var(--divider)" />
            <rect x="16" y="16" width="8" height="20" rx="2" fill="var(--divider)" />
            <rect x="28" y="10" width="8" height="26" rx="2" fill="var(--divider)" />
          </svg>
          <span className="text-[13px]">No data available</span>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

export default StatCardShell;
