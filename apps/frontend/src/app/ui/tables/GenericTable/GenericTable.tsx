'use client';
import { emptyStateCopy } from '@/app/ui/tables/tableUtils';
import React, { useLayoutEffect, useRef, useState } from 'react';

import { NoDataMessage } from '@/app/ui/tables/common';
import TableFooter from '@/app/ui/tables/TableFooter';

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
  /**
   * Plural noun for this table's records, e.g. `appointments` -> "of 14
   * appointments" in the footer and "No appointments yet" in the empty state.
   *
   * REQUIRED on purpose. It was optional, and the one call site that forgot it
   * (the task board) fell back to "No records yet" while the phone card list
   * beside it said "No tasks yet" - the same dataset described two ways
   * depending on window width. A required prop makes that unrepresentable
   * rather than something a review has to catch.
   */
  itemNoun: string;
  /**
   * Overrides the derived empty state when a surface has more useful words than
   * "No <noun> yet". Two dashboard widgets did: the availability table's card
   * branch said "No availability set / Set consultation hours for a practitioner
   * and they appear here", which tells the reader what to DO, and the turnover
   * card branch distinguished "no items" from "stock has not moved this period".
   * Those branches are `xl:hidden` siblings of this table, so without an
   * override the same widget said two different things either side of 1280px.
   */
  emptyTitle?: string;
  emptySubtitle?: string;
  /** Extra classes for one body row — used for row-level states (e.g. emergency). */
  rowClassName?: (item: T, index: number) => string;
}

// Bottom padding applied by .TableBodyScroll — must match Generictable.css
const TABLE_BODY_PADDING_BOTTOM = 16;

/* Derived from the noun, with either half overridable. A named helper rather
   than two conditional spreads inside the component: those read as nested
   ternaries to the complexity rule and pushed the render past its budget. */
const emptyStateProps = (itemNoun: string, title?: string, subtitle?: string) => ({
  ...emptyStateCopy(itemNoun),
  ...(title === undefined ? {} : { title }),
  ...(subtitle === undefined ? {} : { subtitle }),
});

const GenericTable = <T extends object>({
  data,
  columns,
  bordered: _bordered = false,
  pagination = false,
  pageSize = 10,
  tableClassName,
  caption,
  itemNoun,
  emptyTitle,
  emptySubtitle,
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

  const emptyCopy = emptyStateProps(itemNoun, emptyTitle, emptySubtitle);

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 w-full flex-col gap-3 overflow-hidden ${needsFill ? 'h-full' : 'h-auto'} ${showPagination ? 'pb-2' : ''}`}
    >
      <div className={`TableShell yc-surface min-h-0 ${needsFill ? 'flex-1' : ''}`}>
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
                    <NoDataMessage {...emptyCopy} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Design footer: the count sits left, the pager right - not a centred
          prev/count/next cluster. Shared with the sub-xl card list so one resize
          does not swap the control. */}
      {showPagination && (
        <TableFooter
          currentPage={currentPage}
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

export default GenericTable;
export type { Column };
