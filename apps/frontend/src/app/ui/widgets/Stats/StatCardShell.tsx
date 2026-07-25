import React from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';

type StatCardShellProps = {
  title: string;
  options: readonly string[];
  /** Renders the shared bar-chart empty state instead of `children`. */
  isEmpty: boolean;
  children: React.ReactNode;
};

const StatCardShell = ({ title, options, isEmpty, children }: StatCardShellProps) => (
  <div className="flex flex-col gap-2">
    <CardHeader title={title} options={options} selected={options[0]} />
    <div className="flex min-h-75 w-full flex-col gap-2.5 rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5 py-4 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
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
