"use client";
import React, { useState } from "react";

import Next from "../Icons/Next";
import Back from "../Icons/Back";

import "./Generictable.css";

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
  const total = data.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedData = pagination ? data?.slice(startIdx, endIdx) : data;

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="flex flex-col gap-3 w-full">
      <table className="TableDiv mb-3">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={col.width ? { width: col.width } : {}}
              >
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
                  <td
                    key={String(col.key)}
                    style={col.width ? { width: col.width } : {}}
                  >
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
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Back
            onClick={handlePrev}
            disabled={currentPage === 1}
            className={
              currentPage === 1 ? "hover:bg-white! cursor-not-allowed" : ""
            }
          />
          <div className="text-body-4 text-text-primary">
            Showing{" "}
            <span>
              {Math.min(endIdx, total)} of {total}
            </span>
          </div>
          <Next
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className={
              currentPage === totalPages
                ? "hover:bg-white! cursor-not-allowed"
                : ""
            }
          />
        </div>
      )}
    </div>
  );
};

export default GenericTable;
export type { Column };
