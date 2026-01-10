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
};

const AppointmentCalendar = ({
  filteredList,
  setActiveAppointment,
  setViewPopup,
  activeCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart
}: AppointmentCalendarProps) => {
  const handleViewAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setViewPopup?.(true);
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
          setCurrentDate={setCurrentDate}
        />
      )}
      {activeCalendar === "week" && (
        <WeekCalendar
          events={filteredList}
          date={currentDate}
          handleViewAppointment={handleViewAppointment}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
        />
      )}
      {activeCalendar === "vet" && (
        <UserCalendar
          events={dayEvents}
          date={currentDate}
          handleViewAppointment={handleViewAppointment}
          setCurrentDate={setCurrentDate}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
