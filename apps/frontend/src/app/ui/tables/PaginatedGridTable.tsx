'use client';
import React, { useState } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';
import { buildPagerPageList } from '@/app/ui/tables/tableUtils';

import './DataTable.css';
import './GenericTable/Generictable.css';
import { NoDataMessage, emptyStateCopy } from '@/app/ui/tables/common';

export type GridHeaderCell = { label: string; align?: 'right'; className?: string };

const pagerStepClass =
  'flex size-7 items-center justify-center rounded-full border border-card-border text-text-primary transition-colors hover:bg-[var(--surface-soft)]';

type PaginatedGridTableProps<T> = {
  /** Full (already filtered) row set — the shell owns the paging window. */
  rows: T[];
  pageSize: number;
  /** `grid-template-columns` track shared by the sticky header and every row. */
  gridColumns: string;
  /**
   * Horizontal floor for the grid, in px. Must clear the sum of the fixed
   * tracks plus gaps and gutters, or the `fr` columns are starved — one shared
   * 1080px floor left Inventory's twelve columns just 76px to split between its
   * two flexible tracks, collapsing the item name to about 48px.
   */
  minWidthPx?: number;
  headerCells: GridHeaderCell[];
  /** Plural noun for the footer summary, e.g. `items` -> "No items". */
  itemNoun: string;
  /** Renders one desktop grid row. Must set the React key on the returned element. */
  renderRow: (row: T) => React.ReactNode;
  /** Renders one phone card. Must set the React key on the returned element. */
  renderCard: (row: T) => React.ReactNode;
};

const PaginatedGridTable = <T,>({
  rows,
  pageSize,
  gridColumns,
  headerCells,
  itemNoun,
  renderRow,
  renderCard,
  minWidthPx = 1080,
}: PaginatedGridTableProps<T>) => {
  const [page, setPage] = useState(1);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  if (currentPage !== page) setPage(currentPage);
  const startIdx = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(startIdx, startIdx + pageSize);
  const showPagination = totalPages > 1;

  // Rendered in BOTH branches: the card list is the only visible branch at <=1023
  // (`.inventory-table-list` is display:none there), so a pager that lived only
  // inside the table branch left the card list with no way to reach page 2+.
  const footer = (
    <div className="flex w-full shrink-0 items-center justify-between border-t border-card-border px-5 py-3 text-[12.5px] text-text-tertiary">
      <span>
        {total === 0
          ? `No ${itemNoun}`
          : `Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, total)} of ${total} ${itemNoun}`}
      </span>
      {showPagination && (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={`${pagerStepClass} ${currentPage === 1 ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            <IoChevronBackOutline size={13} aria-hidden="true" />
          </button>
          {buildPagerPageList(currentPage, totalPages).map(({ key, page }) =>
            page === null ? (
              <span
                key={key}
                aria-hidden="true"
                className="flex size-7 items-center justify-center text-[12px]"
              >
                …
              </span>
            ) : (
              <button
                key={key}
                type="button"
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
                onClick={() => setPage(page)}
                className={`flex size-7 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors ${
                  page === currentPage
                    ? 'bg-[var(--nav-active-bg)] font-bold text-[var(--nav-active)]'
                    : 'font-semibold text-text-secondary hover:bg-[var(--surface-soft)]'
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            type="button"
            aria-label="Next"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`${pagerStepClass} ${currentPage === totalPages ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            <IoChevronForwardOutline size={13} aria-hidden="true" />
          </button>
        </span>
      )}
    </div>
  );

  return (
    <div className="table-wrapper inventory-scroll-x h-full min-h-0 overflow-hidden">
      <div className="inventory-table-list h-full min-h-0 flex-1">
        {/* `isolate` (isolation:isolate) makes this rounded container own a
            compositing context so overflow-hidden actually clips the
            position:sticky, z-10 header to the 18px corners — otherwise Chrome
            renders the sticky header on its own layer and its square top edge
            pokes out past the rounded corners on scroll repaint (same fix as
            .TableShell in Generictable.css). */}
        <div className="isolate flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
          <div className="min-h-0 flex-1 overflow-auto">
            <div style={{ minWidth: `${minWidthPx}px` }}>
              <div
                className="yc-table-head grid items-center gap-2.5"
                style={{ gridTemplateColumns: gridColumns }}
              >
                {headerCells.map((cell, index) => (
                  <span
                    key={cell.label || `col-${index}`}
                    className={`${cell.align === 'right' ? 'text-right' : ''} ${cell.className ?? ''}`.trim()}
                  >
                    {cell.label}
                  </span>
                ))}
              </div>
              {total === 0 ? (
                <div className="border-t border-card-border">
                  <NoDataMessage {...emptyStateCopy(itemNoun)} />
                </div>
              ) : (
                pageRows.map((row) => renderRow(row))
              )}
            </div>
          </div>
          {footer}
        </div>
      </div>
      <div className="inventory-card-list gap-4 sm:gap-6 flex-wrap">
        {total === 0 ? (
          <NoDataMessage {...emptyStateCopy(itemNoun)} />
        ) : (
          pageRows.map((row) => renderCard(row))
        )}
        {total > 0 && footer}
      </div>
    </div>
  );
};

export default PaginatedGridTable;
