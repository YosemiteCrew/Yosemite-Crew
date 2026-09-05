'use client';
import { emptyStateCopy } from '@/app/ui/tables/tableUtils';
import React, { useState, type ReactNode } from 'react';

import { NoDataMessage } from '@/app/ui/tables/common';
import TableFooter from '@/app/ui/tables/TableFooter';

/* The card list is the sub-xl rendering of the same data the table shows above
   xl, so it has to page like the table does. Without this it rendered every row
   at once: on a dashboard page - where nothing bounds its height - a few hundred
   appointments became a ~64,000px slab that pushed the rest of the page off
   screen and stalled the renderer.

   Paging state stays local - GenericTable keeps its own too - but the footer is
   now the shared `TableFooter` rather than a mirror of it. It used to be a
   centred Back/count/Next cluster with no page numbers, so crossing xl over the
   same rows swapped a numbered pager for two bare arrows, dropped `aria-current`
   and the noun from the count, and left the disabled arrow at full strength
   where the table's is dimmed. */

type PaginatedCardListProps<T> = {
  items: T[];
  pageSize: number;
  renderCard: (item: T, index: number) => ReactNode;
  className?: string;
  listClassName?: string;
  /**
   * Plural noun for the empty state and the footer count, e.g. `tasks` ->
   * "No tasks yet" and "Showing 10 of 12 tasks".
   */
  itemNoun?: string;
};

const PaginatedCardList = <T,>({
  items,
  pageSize,
  renderCard,
  className = '',
  listClassName = '',
  itemNoun = 'records',
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

  return (
    <div className={`flex h-full min-h-0 flex-col gap-3 ${className}`}>
      <div
        className={`min-h-0 flex-1 overflow-y-auto pr-1 flex gap-4 sm:gap-6 flex-wrap content-start ${listClassName}`}
      >
        {total === 0 ? (
          <NoDataMessage {...emptyStateCopy(itemNoun)} />
        ) : (
          pageItems.map((item, index) => renderCard(item, startIdx + index))
        )}
      </div>
      {showPagination && (
        <TableFooter
          currentPage={clampedPage}
          totalPages={totalPages}
          rangeEnd={Math.min(endIdx, total)}
          total={total}
          itemNoun={itemNoun}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

export default PaginatedCardList;
