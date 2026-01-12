import React from "react";
import TaskSlot from "./TaskSlot";
import { eventsForUser } from "../helpers";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import UserLabels from "./UserLabels";
import { Task } from "@/app/types/task";
import Back from "../../Icons/Back";
import Next from "../../Icons/Next";

type UserCalendarProps = {
  events: Task[];
  date: Date;
  handleViewTask: any;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const UserCalendar: React.FC<UserCalendarProps> = ({
  events,
  date,
  handleViewTask,
  setCurrentDate,
}) => {
  const team = useTeamForPrimaryOrg();

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
      <div className="grid h-full grid-cols-[40px_minmax(0,1fr)_40px]">
        <div className="flex items-start justify-center pt-3">
          <Back onClick={handlePrevDay} />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <UserLabels team={team} currentDate={date} />
            <div className="max-h-[500px] overflow-y-auto">
              <div className="grid grid-flow-col auto-cols-[200px] min-w-max">
                {team?.map((user, index) => (
                  <TaskSlot
                    key={user._id + index}
                    height={300}
                    index={index}
                    length={team.length - 1}
                    slotEvents={eventsForUser(events, user)}
                    handleViewTask={handleViewTask}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-start justify-center pt-3">
          <Next onClick={handleNextDay} />
        </div>
      </div>
    </div>
  );
};

export default UserCalendar;
