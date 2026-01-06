import React from "react";
import { getStatusStyle } from "../../DataTable/Tasks";
import { getFormattedDate } from "../../Calendar/weekHelpers";
import { Task } from "@/app/types/task";

type TaskCardProps = {
  item: Task;
  handleViewTask: any;
};

const TaskCard = ({ item, handleViewTask }: TaskCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {item.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Description:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.description}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Category:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.category}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          From:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.assignedBy}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          To:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.assignedTo}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Due date:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {getFormattedDate(item.dueAt)}
        </div>
      </div>
      <div
        style={getStatusStyle(item.status)}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {item.status}
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewTask(item)}
          className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default TaskCard;
