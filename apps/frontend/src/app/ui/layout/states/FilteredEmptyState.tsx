'use client';

import React from 'react';
import { IoCloseCircleOutline, IoFilterOutline } from 'react-icons/io5';
import { Secondary } from '@/app/ui/primitives/Buttons';
import './states.css';

export type FilteredEmptyStateProps = {
  title?: string;
  message?: string;
  /** Real "clear filters" handler; the button is hidden when none is passed. */
  onClearFilters?: () => void;
  clearLabel?: string;
};

const FilteredEmptyState = ({
  title = 'Nothing matches these filters',
  message = 'Try widening the date range or clearing a status filter.',
  onClearFilters,
  clearLabel = 'Clear all filters',
}: FilteredEmptyStateProps) => {
  return (
    <div className="yc-state-card">
      <span className="yc-state-icon yc-state-icon--blue" aria-hidden>
        <IoFilterOutline size={26} />
      </span>
      <div className="yc-state-title">{title}</div>
      <p className="yc-state-text">{message}</p>
      {onClearFilters ? (
        <div className="yc-state-actions">
          <Secondary
            text={clearLabel}
            icon={<IoCloseCircleOutline aria-hidden />}
            onClick={onClearFilters}
          />
        </div>
      ) : null}
    </div>
  );
};

export default FilteredEmptyState;
