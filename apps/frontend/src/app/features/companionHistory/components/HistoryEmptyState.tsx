import React from 'react';

type HistoryEmptyStateProps = {
  isError?: boolean;
  message?: string;
};

const HistoryEmptyState = ({ isError = false, message }: HistoryEmptyStateProps) => {
  return (
    <div
      className="rounded-2xl border border-card-border bg-white px-4 py-6 text-center"
      role={isError ? 'alert' : undefined}
    >
      <div className={isError ? 'text-body-3 text-error-main' : 'text-body-3 text-text-primary'}>
        {message || (isError ? 'Unable to load overview right now.' : 'No overview entries found.')}
      </div>
    </div>
  );
};

export default HistoryEmptyState;
