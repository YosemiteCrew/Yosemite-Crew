import React from "react";
import GenericTable from "../GenericTable/GenericTable";

import { IoEye } from "react-icons/io5";
import DocumentsCard from "../Cards/DocumentsCard";
import { OrganizationDocument } from "@/app/types/document";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type DocumentsTableProps = {
  filteredList: OrganizationDocument[];
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

  const columns: Column<OrganizationDocument>[] = [
    {
      label: "Title",
      key: "title",
      width: "20%",
      render: (item: OrganizationDocument) => (
        <div className="appointment-profile-title">{item.title}</div>
      ),
    },
    {
      label: "Description",
      key: "description",
      width: "35%",
      render: (item: OrganizationDocument) => (
        <div className="appointment-profile-title">{item.description}</div>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "20%",
      render: (item: OrganizationDocument) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: OrganizationDocument) => (
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
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-grey-noti font-satoshi font-semibold">
                No data available
              </div>
            );
          }
          return filteredList.map((item, i) => (
            <DocumentsCard
              key={item.title + i}
              document={item}
              handleViewDocument={handleViewDocument}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default DocumentsTable;
