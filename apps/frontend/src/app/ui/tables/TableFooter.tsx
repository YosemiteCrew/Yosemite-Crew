'use client';
import React from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';

import { buildPagerPageList } from '@/app/ui/tables/tableUtils';

/* The one table footer: count on the left, numbered pager on the right.
   It used to be four of them. GenericTable had this one; PaginatedCardList - the
   sub-xl rendering of the SAME rows - had a centred Back/count/Next cluster with
   no page numbers, no aria-current and a full-strength disabled arrow, and its
   count dropped the noun ("Showing 20 of 25" against "Showing 20 of 25
   appointments"). One browser resize across xl therefore swapped the control and
   reworded the count over an unchanged list. Callers pass the window they are
   showing; the layout, the wording and the disabled treatment live here. */

const pagerStepClass =
  'flex size-7 items-center justify-center rounded-full border border-[var(--hairline)] text-text-primary transition-colors hover:bg-[var(--surface-soft)]';

/* A named helper rather than a ternary inside the className template: the
   inline form reads as a nested ternary to the complexity rule. */
const pageButtonClass = (isCurrent: boolean) =>
  `flex size-7 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors ${
    isCurrent
      ? 'bg-[var(--nav-active-bg)] font-bold text-[var(--nav-active)]'
      : 'font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-soft)]'
  }`;

type TableFooterProps = {
  currentPage: number;
  totalPages: number;
  /** 1-based index of the last record on this page — the N in "Showing N of M". */
  rangeEnd: number;
  total: number;
  /** Plural noun for these records, e.g. `appointments` -> "of 25 appointments". */
  itemNoun: string;
  onPageChange: (page: number) => void;
};

const TableFooter = ({
  currentPage,
  totalPages,
  rangeEnd,
  total,
  itemNoun,
  onPageChange,
}: Readonly<TableFooterProps>) => (
  <div className="shrink-0 flex items-center justify-between gap-3 px-5 text-[12.5px] text-[var(--ink-faint)]">
    <div aria-live="polite">
      Showing{' '}
      <span>
        {rangeEnd} of {total}
      </span>
      {itemNoun ? ` ${itemNoun}` : ''}
    </div>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Previous"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={`${pagerStepClass} ${currentPage === 1 ? 'cursor-not-allowed opacity-40' : ''}`}
      >
        <IoChevronBackOutline size={13} aria-hidden="true" />
      </button>
      {buildPagerPageList(currentPage, totalPages).map(({ key, page }) =>
        page === null ? (
          <span key={key} aria-hidden="true" className="flex size-7 items-center justify-center">
            …
          </span>
        ) : (
          <button
            key={key}
            type="button"
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
            onClick={() => onPageChange(page)}
            className={pageButtonClass(page === currentPage)}
          >
            {page}
          </button>
        )
      )}
      <button
        type="button"
        aria-label="Next"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className={`${pagerStepClass} ${currentPage === totalPages ? 'cursor-not-allowed opacity-40' : ''}`}
      >
        <IoChevronForwardOutline size={13} aria-hidden="true" />
      </button>
    </div>
  </div>
);

export default TableFooter;
