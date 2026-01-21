import React from "react";
import { appointentsForUser } from "../helpers";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import UserLabels from "../Task/UserLabels";
import Slot from "./Slot";
import { Appointment } from "@yosemite-crew/types";
import Back from "../../Icons/Back";
import Next from "../../Icons/Next";

type UserCalendarProps = {
  events: Appointment[];
  date: Date;
  handleViewAppointment: any;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: any;
  canEditAppointments: boolean;
};

const UserCalendar: React.FC<UserCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
  handleRescheduleAppointment,
  setCurrentDate,
  canEditAppointments,
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
      <div className="grid h-full grid-cols-[50px_minmax(0,1fr)_50px]">
        <div className="flex items-start justify-center pt-3">
          <Back onClick={handlePrevDay} />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <UserLabels team={team} currentDate={date} />
            <div className="max-h-[600px] overflow-y-auto">
              <div className="grid grid-flow-col auto-cols-[200px] min-w-max">
                {team?.map((user, index) => (
                  <Slot
                    key={user._id + index}
                    slotEvents={appointentsForUser(events, user)}
                    height={350}
                    dayIndex={index}
                    handleViewAppointment={handleViewAppointment}
                    handleRescheduleAppointment={handleRescheduleAppointment}
                    length={team.length - 1}
                    canEditAppointments={canEditAppointments}
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
