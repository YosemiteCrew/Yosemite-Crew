'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import Next from '@/app/ui/primitives/Icons/Next';
import Back from '@/app/ui/primitives/Icons/Back';

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
}

// Bottom padding applied by .TableBodyScroll — must match Generictable.css
const TABLE_BODY_PADDING_BOTTOM = 16;

const GenericTable = <T extends object>({
  data,
  columns,
  bordered = false,
  pagination = false,
  pageSize = 10,
  tableClassName,
  caption,
}: Readonly<GenericTableProps<T>>) => {
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const [autoPageSize, setAutoPageSize] = useState(pageSize);

  useEffect(() => {
    const totalPages = Math.ceil(data.length / autoPageSize);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0) {
      setCurrentPage(1);
    }
  }, [autoPageSize, currentPage, data.length]);

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
                  <th key={String(col.key)} scope="col">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData?.map((row: any, index: any) => (
                  <tr key={row + index}>
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
                    <div className="w-full py-2.5 flex items-center justify-center text-body-4 text-text-primary">
                      Looks like a quiet day… for now.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showPagination && (
        <div className="shrink-0 flex items-center justify-center gap-3">
          <Back
            onClick={handlePrev}
            disabled={currentPage === 1}
            className={currentPage === 1 ? 'hover:bg-white! cursor-not-allowed' : ''}
          />
          <div className="text-body-4 text-text-primary" aria-live="polite">
            Showing{' '}
            <span>
              {Math.min(endIdx, total)} of {total}
            </span>
          </div>
          <Next
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className={currentPage === totalPages ? 'hover:bg-white! cursor-not-allowed' : ''}
          />
        </div>
      )}
    </div>
  );
};

export default GenericTable;
export type { Column };
