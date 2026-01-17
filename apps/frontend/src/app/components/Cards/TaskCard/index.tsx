import React from "react";
import { getStatusStyle } from "../../DataTable/Tasks";
import { getFormattedDate } from "../../Calendar/weekHelpers";
import { Task } from "@/app/types/task";
import { Secondary } from "../../Buttons";
import { toTitleCase } from "@/app/utils/validators";

type TaskCardProps = {
  item: Task;
  handleViewTask: any;
};

const TaskCard = ({ item, handleViewTask }: TaskCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {item.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Description:</div>
        <div className="text-caption-1 text-text-primary">
          {item.description}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">{toTitleCase(item.category)}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">From:</div>
        <div className="text-caption-1 text-text-primary">
          {item.assignedBy}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">To:</div>
        <div className="text-caption-1 text-text-primary">
          {item.assignedTo}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Due date:</div>
        <div className="text-caption-1 text-text-primary">
          {getFormattedDate(item.dueAt)}
        </div>
      </div>
      <div
        style={getStatusStyle(item.status)}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {toTitleCase(item.status)}
      </div>
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewTask(item)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default TaskCard;
