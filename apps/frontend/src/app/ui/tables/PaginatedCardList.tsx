'use client';
import React, { useState, type ReactNode } from 'react';

import Next from '@/app/ui/primitives/Icons/Next';
import Back from '@/app/ui/primitives/Icons/Back';
import { NoDataMessage } from '@/app/ui/tables/common';

/* The card list is the sub-xl rendering of the same data the table shows above
   xl, so it has to page like the table does. Without this it rendered every row
   at once: on a dashboard page - where nothing bounds its height - a few hundred
   appointments became a ~64,000px slab that pushed the rest of the page off
   screen and stalled the renderer. GenericTable keeps its pagination in internal
   state, so this mirrors its pager rather than sharing it. */

type PaginatedCardListProps<T> = {
  items: T[];
  pageSize: number;
  renderCard: (item: T, index: number) => ReactNode;
  className?: string;
  listClassName?: string;
};

const PaginatedCardList = <T,>({
  items,
  pageSize,
  renderCard,
  className = '',
  listClassName = '',
}: PaginatedCardListProps<T>) => {
  const [currentPage, setCurrentPage] = useState(1);

  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  // Filtering can shrink the list under the current page; follow GenericTable
  // and clamp during render so the user never lands on an empty page.
  const clampedPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  if (clampedPage !== currentPage) setCurrentPage(clampedPage);

  const startIdx = (clampedPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pageItems = items.slice(startIdx, endIdx);
  const showPagination = totalPages > 1;

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className={`flex h-full min-h-0 flex-col gap-3 ${className}`}>
      <div
        className={`min-h-0 flex-1 overflow-y-auto pr-1 flex gap-4 sm:gap-6 flex-wrap content-start ${listClassName}`}
      >
        {total === 0 ? (
          <NoDataMessage
            title="Nothing here yet"
            subtitle="Records appear here as soon as they are added."
          />
        ) : (
          pageItems.map((item, index) => renderCard(item, startIdx + index))
        )}
      </div>
      {showPagination && (
        <div className="shrink-0 flex items-center justify-center gap-3">
          <Back
            onClick={handlePrev}
            disabled={clampedPage === 1}
            className={clampedPage === 1 ? 'hover:bg-neutral-0! cursor-not-allowed' : ''}
          />
          <div className="text-body-4 text-text-primary" aria-live="polite">
            Showing{' '}
            <span>
              {Math.min(endIdx, total)} of {total}
            </span>
          </div>
          <Next
            onClick={handleNext}
            disabled={clampedPage === totalPages}
            className={clampedPage === totalPages ? 'hover:bg-neutral-0! cursor-not-allowed' : ''}
          />
        </div>
      )}
    </div>
  );
};

export default PaginatedCardList;
