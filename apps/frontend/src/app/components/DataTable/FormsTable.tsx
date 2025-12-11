import { FormsProps } from "@/app/types/forms";
import React from "react";
import { IoEye } from "react-icons/io5";
import GenericTable from "../GenericTable/GenericTable";
import FormCard from "../Cards/FormCard";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type FormsTableProps = {
  filteredList: FormsProps[];
  activeForm: FormsProps | null;
  setActiveForm: (companion: FormsProps) => void;
  setViewPopup: (open: boolean) => void;
  loading?: boolean;
};

export const getStatusStyle = (status: string) => {
  if (!status) return { color: "#302F2E", backgroundColor: "#F3F3F3" };
  switch (status.toLowerCase()) {
    case "published":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "draft":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    default:
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
  }
};

const FormsTable = ({
  filteredList,
  activeForm,
  setActiveForm,
  setViewPopup,
  loading = false,
}: FormsTableProps) => {
  const handleViewForm = (companion: FormsProps) => {
    setActiveForm(companion);
    setViewPopup(true);
  };

  const columns: Column<FormsProps>[] = [
    {
      label: "Form name",
      key: "name",
      width: "20%",
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "10%",
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: "Usage",
      key: "usage",
      width: "15%",
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{item.usage}</div>
      ),
    },
    {
      label: "Updated by",
      key: "updatedBy",
      width: "15%",
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{item.updatedBy}</div>
      ),
    },
    {
      label: "Last updated",
      key: "lastUpdated",
      width: "15%",
      render: (item: FormsProps) => (
        <div className="appointment-profile-title">{item.lastUpdated}</div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: FormsProps) => (
        <div
          className="appointment-status"
          style={getStatusStyle(item.status || "")}
        >
          {item.status}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: FormsProps) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewForm(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="#302F2E" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        {loading ? (
          <div className="w-full py-6 flex items-center justify-center text-grey-noti font-satoshi font-semibold">
            Loading forms...
          </div>
        ) : (
          <GenericTable data={filteredList} columns={columns} bordered={false} />
        )}
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (loading) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-grey-noti font-satoshi font-semibold">
                Loading forms...
              </div>
            );
          }
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-grey-noti font-satoshi font-semibold">
                No data available
              </div>
            );
          }
          return filteredList.map((form, index) => (
            <FormCard
              key={index + form.name}
              form={form}
              handleViewForm={handleViewForm}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default FormsTable;
