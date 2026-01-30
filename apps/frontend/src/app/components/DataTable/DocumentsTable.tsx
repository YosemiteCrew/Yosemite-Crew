import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import DocumentsCard from "../Cards/DocumentsCard";
import { OrganizationDocument } from "@/app/types/document";
import { toTitle } from "@/app/utils/validators";
import { Column, NoDataMessage, ViewButton, ProfileTitle } from "./common";

import "./DataTable.css";

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
        <ProfileTitle>{item.title}</ProfileTitle>
      ),
    },
    {
      label: "Description",
      key: "description",
      width: "35%",
      render: (item: OrganizationDocument) => (
        <ProfileTitle>{item.description}</ProfileTitle>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "20%",
      render: (item: OrganizationDocument) => (
        <ProfileTitle>{toTitle(item.category)}</ProfileTitle>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: OrganizationDocument) => (
        <div className="action-btn-col">
          <ViewButton onClick={() => handleViewDocument(item)} />
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
        {filteredList.length === 0 ? (
          <NoDataMessage />
        ) : (
          filteredList.map((item, i) => (
            <DocumentsCard
              key={item.title + i}
              document={item}
              handleViewDocument={handleViewDocument}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default DocumentsTable;
