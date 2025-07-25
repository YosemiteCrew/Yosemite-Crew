"use client";
import React, { useState } from "react";
import { Button, Table } from "react-bootstrap";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

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

function GenericTable<T extends object>({
  data,
  columns,
  bordered = false,
  pagination = false,
  pageSize = 10,
}: GenericTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const total = data.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedData = pagination ? data?.slice(startIdx, endIdx) : data;

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
console.log(paginatedData,"datadatadata")
  return (
    <>
      <Table hover responsive bordered={bordered} className="TableDiv mb-3">
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
          {paginatedData && paginatedData.length >0 && paginatedData?.map((row, index) => (
            <tr key={index}>
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  style={col.width ? { width: col.width } : {}}
                >
                  <div className="td-inner">
                    {col.render
                      ? col.render(row, index)
                      : (typeof col.key === "string"
                          ? (row[col.key as keyof T] as React.ReactNode)
                          : (row[col.key] as React.ReactNode))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      {pagination && totalPages > 1 && (
        <div className="custom-pagination" >
          <Button onClick={handlePrev} disabled={currentPage === 1} style={{ cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
            <FiArrowLeft size={20}/>
          </Button>
          <p>Showing <span>{Math.min(endIdx, total)} of {total}</span></p>
          <Button onClick={handleNext} disabled={currentPage === totalPages} style={{  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
            <FiArrowRight size={20}/>
          </Button>
        </div>
      )}
    </>
  );
}

export default GenericTable;
export type { Column };