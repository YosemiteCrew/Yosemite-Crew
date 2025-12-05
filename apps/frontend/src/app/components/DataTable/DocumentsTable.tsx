import React from "react";
import { Document } from "@/app/pages/Organization/types";
import GenericTable from "../GenericTable/GenericTable";

import "./DataTable.css";
import { IoEye } from "react-icons/io5";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type DocumentsTableProps = {
  filteredList: Document[];
  setActive?: (document: any) => void;
  setView?: (open: boolean) => void;
};

const DocumentsTable = ({
  filteredList,
  setActive,
  setView,
}: DocumentsTableProps) => {
  const handleViewDocument = (team: any) => {
    setActive?.(team);
    setView?.(true);
  };

  const columns: Column<Document>[] = [
    {
      label: "Title",
      key: "title",
      width: "20%",
      render: (item: Document) => (
        <div className="appointment-profile-title">{item.title}</div>
      ),
    },
    {
      label: "Description",
      key: "description",
      width: "40%",
      render: (item: Document) => (
        <div className="appointment-profile-title">{item.description}</div>
      ),
    },
    {
      label: "Date",
      key: "date",
      width: "15%",
      render: (item: Document) => (
        <div className="appointment-profile-title">{item.date}</div>
      ),
    },
    {
      label: "Last updated",
      key: "Last updated",
      width: "15%",
      render: (item: Document) => (
        <div className="appointment-profile-title">{item.lastUpdated}</div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: Document) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewDocument(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={18} color="#302F2E" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
        />
      </div>
    </div>
  );
};

export default DocumentsTable;
