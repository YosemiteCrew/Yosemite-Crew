import React from "react";
import { appointentsForUser } from "../helpers";
import { GrNext, GrPrevious } from "react-icons/gr";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import UserLabels from "../Task/UserLabels";
import Slot from "./Slot";
import { Appointment } from "@yosemite-crew/types";

type UserCalendarProps = {
  events: Appointment[];
  date: Date;
  handleViewAppointment: any;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const UserCalendar: React.FC<UserCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
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
          <GrPrevious
            size={20}
            color="#302f2e"
            className="cursor-pointer"
            onClick={handlePrevDay}
          />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <UserLabels team={team} currentDate={date} />
            <div className="max-h-[600px] overflow-y-auto">
              <div className="grid grid-flow-col auto-cols-[200px] gap-x-2 min-w-max">
                {team?.map((user, index) => (
                  <Slot
                    key={user._id}
                    slotEvents={appointentsForUser(events, user)}
                    height={300}
                    dayIndex={index}
                    handleViewAppointment={handleViewAppointment}
                    length={team.length-1}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-start justify-center pt-3">
          <GrNext
            size={20}
            color="#302f2e"
            className="cursor-pointer"
            onClick={handleNextDay}
          />
        </div>
      </div>
    </div>
  );
};

export default UserCalendar;
