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
    <div className="bg-neutral-0 border border-card-border p-3 rounded-2xl w-full min-h-75 flex flex-col gap-3">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 text-text-tertiary flex-1">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect x="4" y="24" width="8" height="12" rx="2" fill="var(--color-neutral-200)" />
            <rect x="16" y="16" width="8" height="20" rx="2" fill="var(--color-neutral-200)" />
            <rect x="28" y="10" width="8" height="26" rx="2" fill="var(--color-neutral-200)" />
          </svg>
          <span className="text-body-3">No data available</span>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

export default StatCardShell;
