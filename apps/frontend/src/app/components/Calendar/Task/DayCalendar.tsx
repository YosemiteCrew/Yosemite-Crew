import React, { useMemo } from "react";
import { getStatusStyle } from "../../DataTable/Tasks";
import { Task } from "@/app/types/task";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Team } from "@/app/types/team";
import Back from "../../Icons/Back";
import Next from "../../Icons/Next";

type DayCalendarProps = {
  events: Task[];
  date: Date;
  handleViewTask: any;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const DayCalendar = ({
  events,
  date,
  handleViewTask,
  setCurrentDate,
}: DayCalendarProps) => {
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

  const handleNextDay = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  };

  const handlePrevDay = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
  });
  const dateNumber = date.getDate();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <Back onClick={handlePrevDay} />
        <div className="flex flex-col">
          <div className="text-body-4 text-text-brand">{weekday}</div>
          <div className="text-body-4-emphasis text-white h-12 w-12 flex items-center justify-center rounded-full bg-text-brand">
            {dateNumber}
          </div>
        </div>
        <Next onClick={handleNextDay} />
      </div>
      {events.length > 0 ? (
        <div className="overflow-y-auto overflow-x-hidden flex-1 max-h-[500px] flex flex-col gap-2 p-3">
          {events.map((event, i) => (
            <button
              key={event.name + i}
              className="rounded-2xl! p-3 flex flex-col items-start w-full gap-2"
              style={getStatusStyle(event.status)}
              onClick={() => handleViewTask(event)}
            >
              <div className="text-body-3-emphasis">
                {event.name}
              </div>
              <div className="text-body-4">
                {resolveMemberName(event.assignedTo)}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full flex items-center justify-center text-caption-1 text-text-primary h-[200px]">
          No tasks available for today
        </div>
      )}
    </div>
  );
};

export default DayCalendar;
