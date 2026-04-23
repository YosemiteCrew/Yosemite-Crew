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
}

const GenericTable = <T extends object>({
  data,
  columns,
  bordered = false,
  pagination = false,
  pageSize = 10,
}: Readonly<GenericTableProps<T>>) => {
  const [currentPage, setCurrentPage] = useState(1);
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
    const node = bodyScrollRef.current;
    if (!node || !pagination) {
      setAutoPageSize(pageSize);
      return;
    }

    const updatePageSize = () => {
      const headerRow = node.querySelector('thead tr') as HTMLTableRowElement | null;
      const bodyRow = node.querySelector('tbody tr') as HTMLTableRowElement | null;
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

      const availableHeight = node.clientHeight - headerHeight;
      const fittedRows = Math.max(pageSize, Math.floor(availableHeight / rowHeight));
      setAutoPageSize(fittedRows);
    };

    updatePageSize();

    const resizeObserver = new ResizeObserver(() => {
      updatePageSize();
    });

    resizeObserver.observe(node);
    globalThis.window.addEventListener('resize', updatePageSize);

    return () => {
      resizeObserver.disconnect();
      globalThis.window.removeEventListener('resize', updatePageSize);
    };
  }, [data.length, pageSize, pagination]);

  const total = data.length;
  const totalPages = Math.ceil(total / autoPageSize);
  const startIdx = (currentPage - 1) * autoPageSize;
  const endIdx = startIdx + autoPageSize;
  const paginatedData = pagination ? data?.slice(startIdx, endIdx) : data;
  const showPagination = pagination && total > autoPageSize;
  const fillsAvailableHeight = showPagination;

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    <div
      className={`flex min-h-0 w-full flex-col gap-3 overflow-hidden ${fillsAvailableHeight ? 'h-full' : ''} ${showPagination ? 'pb-2' : ''}`}
    >
      <div className={`TableShell min-h-0 ${fillsAvailableHeight ? 'flex-1' : ''}`}>
        <div
          ref={bodyScrollRef}
          className={`TableBodyScroll min-h-0 overflow-y-auto scrollbar-custom ${fillsAvailableHeight ? 'h-full' : ''}`}
        >
          <table className="TableDiv">
            <colgroup>
              {columns.map((col) => (
                <col key={String(col.key)} style={col.width ? { width: col.width } : {}} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={String(col.key)}>{col.label}</th>
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
      {showPagination && totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-3">
          <Back
            onClick={handlePrev}
            disabled={currentPage === 1}
            className={currentPage === 1 ? 'hover:bg-white! cursor-not-allowed' : ''}
          />
          <div className="text-body-4 text-text-primary">
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
