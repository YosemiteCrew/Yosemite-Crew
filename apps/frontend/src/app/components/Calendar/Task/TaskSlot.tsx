import { TasksProps } from "@/app/types/tasks";
import React from "react";
import { getStatusStyle } from "../../DataTable/Tasks";

type TaskSlotProps = {
  slotEvents: TasksProps[];
  handleViewTask: (task: TasksProps) => void;
  dayIndex: number;
};

const TaskSlot = ({ slotEvents, handleViewTask, dayIndex }: TaskSlotProps) => {
  return (
    <div>
      {slotEvents.length > 0 ? (
        <div
          className={`flex flex-col gap-2 rounded-2xl border border-grey-light p-2 my-2 bg-white"`}
        >
          {slotEvents.map((ev, i) => (
            <button
              key={`${ev.task}-${ev.due.toISOString()}-${i}`}
              className="rounded px-1 py-1 flex flex-col gap-3"
              style={getStatusStyle(ev.status)}
              onClick={() => handleViewTask(ev)}
            >
              <div className="font-satoshi text-[15px] font-medium text-left">
                {ev.task}
              </div>
              <div className="font-satoshi text-[13px] font-normal text-left">
                {ev.to}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full flex items-center rounded-2xl justify-center text-[15px] font-satoshi border border-grey-light my-2 text-grey-noti font-medium h-[300px]">
          No tasks available
        </div>
      )}
    </div>
  );
};

export default TaskSlot;
