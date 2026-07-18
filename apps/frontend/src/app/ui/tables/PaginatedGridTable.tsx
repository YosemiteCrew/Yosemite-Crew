'use client';
import React, { useState } from 'react';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';

import './DataTable.css';

export type GridHeaderCell = { label: string; align?: 'right'; className?: string };

type PaginatedGridTableProps<T> = {
  /** Full (already filtered) row set — the shell owns the paging window. */
  rows: T[];
  pageSize: number;
  /** `grid-template-columns` track shared by the sticky header and every row. */
  gridColumns: string;
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
        <span className="flex items-center gap-2">
          <Back
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={currentPage === 1 ? 'cursor-not-allowed opacity-40' : ''}
          />
          <span className="tabular-nums text-text-secondary">
            {currentPage} / {totalPages}
          </span>
          <Next
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={currentPage === totalPages ? 'cursor-not-allowed opacity-40' : ''}
          />
        </span>
      )}
    </div>
  );

  return (
    <div className="table-wrapper inventory-scroll-x h-full min-h-0 overflow-hidden">
      <div className="inventory-table-list h-full min-h-0 flex-1">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="min-w-[1080px]">
              <div
                className="sticky top-0 z-10 grid items-center gap-2.5 bg-[var(--screen-2)] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.09em] text-text-tertiary"
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
                <div className="flex w-full items-center justify-center border-t border-card-border py-10 text-body-4 text-text-primary">
                  Looks like a quiet day… for now.
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
          <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
            No data available
          </div>
        ) : (
          pageRows.map((row) => renderCard(row))
        )}
        {total > 0 && footer}
      </div>
    </div>
  );
};

export default PaginatedGridTable;
