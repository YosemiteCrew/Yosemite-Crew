import React, { useMemo } from "react";
import { getStatusStyle } from "../../DataTable/Tasks";
import { Task } from "@/app/types/task";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Team } from "@/app/types/team";

type TaskSlotProps = {
  slotEvents: Task[];
  handleViewTask: (task: Task) => void;
};

const TaskSlot = ({ slotEvents, handleViewTask }: TaskSlotProps) => {
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
          className={`flex flex-col gap-2 rounded-2xl border border-grey-light p-2 my-2 bg-white"`}
        >
          {slotEvents.map((ev, i) => (
            <button
              key={`${ev.name}-${ev.dueAt}-${i}`}
              className="rounded px-1 py-1 flex flex-col gap-3"
              style={getStatusStyle(ev.status)}
              onClick={() => handleViewTask(ev)}
            >
              <div className="font-satoshi text-[15px] font-medium text-left">
                {ev.name}
              </div>
              <div className="font-satoshi text-[13px] font-normal text-left">
                {resolveMemberName(ev.assignedTo)}
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
