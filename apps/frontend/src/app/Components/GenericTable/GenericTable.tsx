"use client";
import React from "react";
import { Table } from "react-bootstrap";
import "./GenericTable.css"

// Column interface
interface Column<T> {
  label: string;
  key: keyof T;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string | number;
}

// GenericTable props
interface GenericTableProps<T extends object> {
  data: T[];
  columns: Column<T>[];
  bordered?: boolean;
}

function GenericTable<T extends object>({
  data,
  columns,
  bordered = false,
}: GenericTableProps<T>) {
  return (
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
        {data.map((row, index) => (
          <tr key={index}>
            {columns.map((col) => (
              <td
                key={String(col.key)}
                style={col.width ? { width: col.width } : {}}
              >
                <div className="td-inner">
                  {col.render ? col.render(row, index) : (row[col.key] as React.ReactNode)}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default GenericTable;
export type { Column };
