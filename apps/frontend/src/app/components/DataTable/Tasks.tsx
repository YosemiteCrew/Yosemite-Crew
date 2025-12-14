import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { TasksProps } from "@/app/types/tasks";
import { IoEye } from "react-icons/io5";
import TaskCard from "../Cards/TaskCard";

import "./DataTable.css";
import { getFormattedDate } from "../Calendar/weekHelpers";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type TaskTableProps = {
  filteredList: TasksProps[];
  setActiveTask?: (inventory: TasksProps) => void;
  setViewPopup?: (open: boolean) => void;
  hideActions?: boolean;
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "in-progress":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "completed":
      return { color: "#fff", backgroundColor: "#008F5D" };
    default:
      return { color: "#fff", backgroundColor: "#247AED" };
  }
};

const Tasks = ({
  filteredList,
  setActiveTask,
  setViewPopup,
  hideActions = false,
}: TaskTableProps) => {
  const handleViewTask = (task: TasksProps) => {
    setActiveTask?.(task);
    setViewPopup?.(true);
  };
  const columns: Column<TasksProps>[] = [
    {
      label: "Task",
      key: "task",
      width: "15%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.task}</div>
      ),
    },
    {
      label: "Description",
      key: "description",
      width: "20%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.description}</div>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: "From",
      key: "from",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.from}</div>
      ),
    },
    {
      label: "To",
      key: "to",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{item.to}</div>
          <div className="appointment-profile-sub">{item.toLabel}</div>
        </div>
      ),
    },
    {
      label: "Due date",
      key: "due",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">
          {getFormattedDate(item.due)}
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: TasksProps) => (
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {item.status}
        </div>
      ),
    },
  ];
  const actionColoumn = {
    label: "Actions",
    key: "actions",
    width: "10%",
    render: (item: TasksProps) => (
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
              <div className="w-full py-6 flex items-center justify-center text-grey-noti font-satoshi font-semibold">
                No data available
              </div>
            );
          }
          return filteredList.map((item: TasksProps, i) => (
            <TaskCard
              key={item.task + i}
              item={item}
              handleViewTask={handleViewTask}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default Tasks;
