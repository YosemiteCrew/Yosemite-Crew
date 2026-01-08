import React, { useMemo } from "react";
import { GrNext, GrPrevious } from "react-icons/gr";
import { getDayWithDate } from "../helpers";
import { getStatusStyle } from "../../DataTable/Tasks";
import { Task } from "@/app/types/task";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Team } from "@/app/types/team";

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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <GrPrevious
          size={20}
          color="#302f2e"
          onClick={handlePrevDay}
          className="cursor-pointer"
        />
        <div className="font-grotesk font-medium text-black-text text-[18px]">
          {getDayWithDate(date)}
        </div>
        <GrNext
          size={20}
          color="#302f2e"
          onClick={handleNextDay}
          className="cursor-pointer"
        />
      </div>
      {events.length > 0 ? (
        <div className="overflow-y-auto overflow-x-hidden flex-1 max-h-[500px] flex flex-col gap-2 p-3">
          {events.map((event, i) => (
            <button
              key={event.name + i}
              className="rounded-2xl! p-2 flex flex-col items-start w-full"
              style={getStatusStyle(event.status)}
              onClick={() => handleViewTask(event)}
            >
              <div className="font-satoshi text-[18px] font-medium">
                {event.name}
              </div>
              <div className="font-satoshi text-[15px] font-medium">
                {resolveMemberName(event.assignedTo)}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full flex items-center justify-center text-[15px] font-satoshi text-grey-noti font-medium h-[200px]">
          No tasks available for today
        </div>
      )}
    </div>
  );
};

export default DayCalendar;
