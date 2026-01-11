import React, { useMemo } from "react";
import { getStatusStyle } from "../../DataTable/Tasks";
import { Task } from "@/app/types/task";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Team } from "@/app/types/team";

type TaskSlotProps = {
  slotEvents: Task[];
  handleViewTask: (task: Task) => void;
  index: number;
  length: number;
  height: number;
};

const TaskSlot = ({
  slotEvents,
  handleViewTask,
  index,
  length,
  height = 300
}: TaskSlotProps) => {
  const teams = useTeamForPrimaryOrg();

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    teams?.forEach((member: Team) => {
      map.set(member._id, member.name || "-");
    });
    return map;
  }, [teams]);

  const resolveMemberName = (id?: string) =>
    id ? (memberMap.get(id) ?? "-") : "-";

  return (
    <div>
      {slotEvents.length > 0 ? (
        <div
          className={`overflow-auto scrollbar-hidden flex flex-col gap-2 p-2 bg-white border-l border-grey-light ${index === length && "border-r"}`}
          style={{ height: `${height}px` }}
        >
          {slotEvents.map((ev, i) => (
            <button
              key={`${ev.name}-${ev.dueAt}-${i}`}
              className="rounded px-1 py-1 flex flex-col gap-2"
              style={getStatusStyle(ev.status)}
              onClick={() => handleViewTask(ev)}
            >
              <div className="text-body-4-emphasis truncate text-left">
                {ev.name}
              </div>
              <div className="text-body-4 truncate text-left">
                {resolveMemberName(ev.assignedTo)}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div
          className={`w-full flex items-center justify-center text-caption-1 text-text-primary border-l border-grey-light h-[300px] ${index === length && "border-r"}`}
          style={{ height: `${height}px` }}
        >
          No tasks available
        </div>
      )}
    </div>
  );
};

export default TaskSlot;
