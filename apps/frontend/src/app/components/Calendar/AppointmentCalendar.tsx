import React, { useMemo } from "react";
import { isSameDay } from "./helpers";
import DayCalendar from "./common/DayCalendar";
import Header from "./common/Header";
import WeekCalendar from "./common/WeekCalendar";
import { Appointment } from "@yosemite-crew/types";
import UserCalendar from "./common/UserCalendar";

type AppointmentCalendarProps = {
  filteredList: Appointment[];
  setActiveAppointment?: (inventory: Appointment) => void;
  setViewPopup?: (open: boolean) => void;
  activeCalendar: string;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  setReschedulePopup: React.Dispatch<React.SetStateAction<boolean>>;
  canEditAppointments: boolean;
};

const AppointmentCalendar = ({
  filteredList,
  setActiveAppointment,
  setViewPopup,
  activeCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  setReschedulePopup,
  canEditAppointments
}: AppointmentCalendarProps) => {
  const handleViewAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setViewPopup?.(true);
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setReschedulePopup?.(true);
  };

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isSameDay(new Date(event.startTime), currentDate)
      ),
    [filteredList, currentDate]
  );

  return (
    <div className="border border-grey-light rounded-2xl w-full flex flex-col">
      <Header currentDate={currentDate} setCurrentDate={setCurrentDate} />
      {activeCalendar === "day" && (
        <DayCalendar
          events={dayEvents}
          date={currentDate}
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
        />
      )}
      {activeCalendar === "week" && (
        <WeekCalendar
          events={filteredList}
          date={currentDate}
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
        />
      )}
      {activeCalendar === "team" && (
        <UserCalendar
          events={dayEvents}
          date={currentDate}
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
