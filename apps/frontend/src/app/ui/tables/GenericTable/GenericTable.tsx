'use client';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';

import { NoDataMessage, emptyStateCopy } from '@/app/ui/tables/common';
import { buildPagerPageList } from '@/app/ui/tables/tableUtils';

import './Generictable.css';

interface Column<T> {
  label: string;
  key: keyof T | string;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string | number;
}

interface GenericTableProps<T extends object> {
  data: T[];
  columns: Column<T>[];
  bordered?: boolean;
  pagination?: boolean;
  pageSize?: number;
  tableClassName?: string;
  caption?: string;
  /** Plural noun for the footer caption, e.g. `appointments` -> "of 14 appointments". */
  itemNoun?: string;
  /** Extra classes for one body row — used for row-level states (e.g. emergency). */
  rowClassName?: (item: T, index: number) => string;
}

const pagerStepClass =
  'flex size-7 items-center justify-center rounded-full border border-[var(--hairline)] text-text-primary transition-colors hover:bg-[var(--surface-soft)]';

// Bottom padding applied by .TableBodyScroll — must match Generictable.css
const TABLE_BODY_PADDING_BOTTOM = 16;

const GenericTable = <T extends object>({
  data,
  columns,
  bordered: _bordered = false,
  pagination = false,
  pageSize = 10,
  tableClassName,
  caption,
  itemNoun,
  rowClassName,
}: Readonly<GenericTableProps<T>>) => {
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const [autoPageSize, setAutoPageSize] = useState(pageSize);

  const totalPagesForClamp = Math.ceil(data.length / autoPageSize);
  const clampedPage = totalPagesForClamp === 0 ? 1 : Math.min(currentPage, totalPagesForClamp);
  if (clampedPage !== currentPage) setCurrentPage(clampedPage);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const scrollNode = bodyScrollRef.current;
    if (!container || !scrollNode || !pagination) {
      setAutoPageSize(pageSize);
      return;
    }

    const updatePageSize = () => {
      const headerRow = scrollNode.querySelector('thead tr') as HTMLTableRowElement | null;
      const bodyRow = scrollNode.querySelector('tbody tr') as HTMLTableRowElement | null;
      /* v8 ignore next 4 -- the table always renders a thead tr and a tbody tr (data or no-data row), so these are never null while pagination is active */
      if (!headerRow || !bodyRow) {
        setAutoPageSize(pageSize);
        return;
      }

      const headerHeight = headerRow.getBoundingClientRect().height;
      const rowHeight = bodyRow.getBoundingClientRect().height;
      if (headerHeight <= 0 || rowHeight <= 0) {
        setAutoPageSize(pageSize);
        return;
      }

      // Measure the outer container (includes pagination bar space) so the
      // fitted-row calculation is stable regardless of whether the bar is
      // currently rendered — this breaks the show-pagination ↔ resize loop.
      const containerHeight = container.getBoundingClientRect().height;

      // Reserve space for the pagination bar (≈ 36px icon + 8px gap above +
      // 8px gap below) so the last row never gets hidden behind it.
      const PAGINATION_BAR_RESERVE = 52;

      const usableHeight =
        containerHeight - headerHeight - TABLE_BODY_PADDING_BOTTOM - PAGINATION_BAR_RESERVE;

      const fittedRows = Math.max(pageSize, Math.floor(usableHeight / rowHeight));
      setAutoPageSize(fittedRows);
    };

    updatePageSize();

    const resizeObserver = new ResizeObserver(updatePageSize);
    resizeObserver.observe(container);
    globalThis.window.addEventListener('resize', updatePageSize);

    return () => {
      resizeObserver.disconnect();
      globalThis.window.removeEventListener('resize', updatePageSize);
    };
    // Intentionally excludes data.length: data changes don't affect row/header
    // height, and including it was causing a resize-loop when filters changed.
  }, [pageSize, pagination]);

  const total = data.length;
  const totalPages = Math.ceil(total / autoPageSize);
  const startIdx = (currentPage - 1) * autoPageSize;
  const endIdx = startIdx + autoPageSize;
  const paginatedData = pagination ? data?.slice(startIdx, endIdx) : data;
  const showPagination = pagination && totalPages > 1;

  // Shrink to content when all rows fit — no empty space below last row.
  // Keep h-full only when data overflows (needs scroll or pagination).
  const needsFill = pagination && total > autoPageSize;

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 w-full flex-col gap-3 overflow-hidden ${needsFill ? 'h-full' : 'h-auto'} ${showPagination ? 'pb-2' : ''}`}
    >
      <div className={`TableShell min-h-0 ${needsFill ? 'flex-1' : ''}`}>
        <div
          ref={bodyScrollRef}
          className={`TableBodyScroll min-h-0 overflow-y-auto scrollbar-custom ${needsFill ? 'h-full' : 'h-auto'}`}
        >
          <table className={['TableDiv', tableClassName].filter(Boolean).join(' ')}>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <colgroup>
              {columns.map((col) => (
                <col key={String(col.key)} style={col.width ? { width: col.width } : {}} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={String(col.key)} scope="col" title={col.label || undefined}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData?.map((row: any, index: any) => (
                  <tr key={row + index} className={rowClassName?.(row, index) || undefined}>
                    {columns.map((col) => (
                      <td key={String(col.key)}>
                        <div className="td-inner">
                          {col.render ? col.render(row, index) : row[col.key]}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>
                    <NoDataMessage {...emptyStateCopy(itemNoun ?? 'records')} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Design footer: the count sits left, the pager right — not a centred
          prev/count/next cluster. */}
      {showPagination && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 text-[12.5px] text-[var(--ink-faint)]">
          <div aria-live="polite">
            Showing{' '}
            <span>
              {Math.min(endIdx, total)} of {total}
            </span>
            {itemNoun ? ` ${itemNoun}` : ''}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous"
              onClick={handlePrev}
              disabled={currentPage === 1}
              className={`${pagerStepClass} ${currentPage === 1 ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <IoChevronBackOutline size={13} aria-hidden="true" />
            </button>
            {buildPagerPageList(currentPage, totalPages).map(({ key, page }) =>
              page === null ? (
                <span
                  key={key}
                  aria-hidden="true"
                  className="flex size-7 items-center justify-center"
                >
                  …
                </span>
              ) : (
                <button
                  key={key}
                  type="button"
                  aria-label={`Page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                  onClick={() => setCurrentPage(page)}
                  className={`flex size-7 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors ${
                    page === currentPage
                      ? 'bg-[var(--nav-active-bg)] font-bold text-[var(--nav-active)]'
                      : 'font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              type="button"
              aria-label="Next"
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={`${pagerStepClass} ${currentPage === totalPages ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <IoChevronForwardOutline size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenericTable;
export type { Column };
