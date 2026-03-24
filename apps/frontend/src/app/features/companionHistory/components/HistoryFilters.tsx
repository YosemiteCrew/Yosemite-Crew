import React from 'react';
import clsx from 'clsx';
import { HISTORY_FILTERS, HistoryFilterKey } from '@/app/features/companionHistory/types/history';

type HistoryFiltersProps = {
  activeFilter: HistoryFilterKey;
  onChange: (filter: HistoryFilterKey) => void;
};

const HistoryFilters = ({ activeFilter, onChange }: HistoryFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="History filters">
      {HISTORY_FILTERS.map((filter) => (
        <button
          key={filter.key}
          type="button"
          role="tab"
          aria-selected={activeFilter === filter.key}
          className={clsx(
            'rounded-full border px-3 py-1.5 text-caption-1 transition-colors',
            activeFilter === filter.key
              ? 'border-text-brand bg-blue-light text-blue-text'
              : 'border-card-border bg-white text-text-secondary hover:bg-card-hover'
          )}
          onClick={() => onChange(filter.key)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
};

export default HistoryFilters;
