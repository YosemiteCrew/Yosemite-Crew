import { FormsProps } from "@/app/types/forms";
import React, { useMemo } from "react";
import { IoEye } from "react-icons/io5";
import GenericTable from "../GenericTable/GenericTable";
import FormCard from "../Cards/FormCard";
import { useTeamStore } from "@/app/stores/teamStore";

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
      return { color: "#F7F7F7", backgroundColor: "#747283" };
    case "draft":
      return { color: "#F7F7F7", backgroundColor: "#BF9FAA" };
    case "archived":
      return { color: "#F7F7F7", backgroundColor: "#D9A488" };
    default:
      return { color: "#F7F7F7", backgroundColor: "#D28F9A" };
  }
};

const FormsTable = ({
  filteredList,
  activeForm,
  setActiveForm,
  setViewPopup,
  loading = false,
}: FormsTableProps) => {
  const { teamsById } = useTeamStore();

  // Create a lookup map from practitioner ID to team member name
  const userIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const team of Object.values(teamsById)) {
      if (team.practionerId && team.name) {
        map[team.practionerId] = team.name;
      }
    }
    return map;
  }, [teamsById]);

  const getUserName = (userId: string) => {
    return userIdToName[userId] || userId;
  };

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
        <div className="appointment-profile-title">{getUserName(item.updatedBy)}</div>
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
          <GenericTable data={filteredList} columns={columns} bordered={false} pagination pageSize={10} />
        )}
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (loading) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                Loading forms...
              </div>
            );
          }
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((form, index) => (
            <FormCard
              key={index + form.name}
              form={form}
              handleViewForm={handleViewForm}
              getUserName={getUserName}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default FormsTable;
