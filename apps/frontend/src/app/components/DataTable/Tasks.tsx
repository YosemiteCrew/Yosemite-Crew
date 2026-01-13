import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { IoEye } from "react-icons/io5";
import TaskCard from "../Cards/TaskCard";
import { getFormattedDate } from "../Calendar/weekHelpers";
import { Task } from "@/app/types/task";

import "./DataTable.css";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Team } from "@/app/types/team";
import { toTitleCase } from "@/app/utils/validators";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type TaskTableProps = {
  filteredList: Task[];
  setActiveTask?: (inventory: Task) => void;
  setViewPopup?: (open: boolean) => void;
  hideActions?: boolean;
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return { color: "#fff", backgroundColor: "#747283" };
    case "in_progress":
      return { color: "#fff", backgroundColor: "#BF9FAA" };
    case "completed":
      return { color: "#fff", backgroundColor: "#D28F9A" };
    default:
      return { color: "#fff", backgroundColor: "#D9A488" };
  }
};

const Tasks = ({
  filteredList,
  setActiveTask,
  setViewPopup,
  hideActions = false,
}: TaskTableProps) => {
  const teams = useTeamForPrimaryOrg();

  const memberMap = React.useMemo(() => {
    const map = new Map<string, string>();
    teams?.forEach((member: Team) => {
      map.set(member._id, member.name || "-");
    });
    return map;
  }, [teams]);

  const getMemberNameById = (id?: string) =>
    id ? (memberMap.get(id) ?? "-") : "-";

  const handleViewTask = (task: Task) => {
    setActiveTask?.(task);
    setViewPopup?.(true);
  };

  const columns: Column<Task>[] = [
    {
      label: "Task",
      key: "task",
      width: "15%",
      render: (item: Task) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: "Description",
      key: "description",
      width: "20%",
      render: (item: Task) => (
        <div className="appointment-profile-title">{item.description}</div>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "10%",
      render: (item: Task) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: "From",
      key: "from",
      width: "10%",
      render: (item: Task) => (
        <div className="appointment-profile-title">
          {getMemberNameById(item.assignedBy)}
        </div>
      ),
    },
    {
      label: "To",
      key: "to",
      width: "10%",
      render: (item: Task) => (
        <div className="appointment-profile-title">
          {getMemberNameById(item.assignedTo)}
        </div>
      ),
    },
    {
      label: "Due date",
      key: "due",
      width: "10%",
      render: (item: Task) => (
        <div className="appointment-profile-title">
          {getFormattedDate(item.dueAt)}
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: Task) => (
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {toTitleCase(item.status)}
        </div>
      ),
    },
  ];
  const actionColoumn = {
    label: "Actions",
    key: "actions",
    width: "10%",
    render: (item: Task) => (
      <div className="action-btn-col">
        <button
          onClick={() => handleViewTask(item)}
          className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
        >
          <IoEye size={20} color="#302F2E" />
        </button>
      </div>
    ),
  };

  const finalColoumns = hideActions ? columns : [...columns, actionColoumn];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable
          data={filteredList}
          columns={finalColoumns}
          bordered={false}
        />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((item: Task, i) => (
            <TaskCard
              key={item.name + i}
              item={{
                ...item,
                assignedTo: getMemberNameById(item.assignedTo),
                assignedBy: getMemberNameById(item.assignedBy),
              }}
              handleViewTask={handleViewTask}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default Tasks;
