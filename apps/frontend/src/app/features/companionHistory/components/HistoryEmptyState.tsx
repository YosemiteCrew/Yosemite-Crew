import React from 'react';
import CompanionRecordsEmptyState from '@/app/features/documents/components/CompanionRecordsEmptyState';

type HistoryEmptyStateProps = {
  isError?: boolean;
  message?: string;
};

const HistoryEmptyState = ({ isError = false, message }: HistoryEmptyStateProps) => {
  // The plain no-entries case takes the design's rich records empty state (64px
  // blue-soft folder chip, Newsreader headline, muted copy). Errors and the
  // caller-supplied notices stay in the compact notice box.
  if (!isError && !message) {
    return <CompanionRecordsEmptyState />;
  }

  return (
    <div
      className="rounded-2xl border border-card-border bg-neutral-0 px-4 py-6 text-center"
      role={isError ? 'alert' : undefined}
    >
      <div className={isError ? 'text-body-3 text-error-main' : 'text-body-3 text-text-primary'}>
        {message || 'Unable to load overview right now.'}
      </div>
    </div>
  );
};

export default HistoryEmptyState;
