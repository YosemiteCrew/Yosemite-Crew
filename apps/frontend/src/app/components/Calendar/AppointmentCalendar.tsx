import { AppointmentsProps } from "@/app/types/appointments";
import React, { useMemo } from "react";
import { isSameDay } from "./helpers";
import DayCalendar from "./common/DayCalendar";
import Header from "./common/Header";
import WeekCalendar from "./common/WeekCalendar";

type AppointmentCalendarProps = {
  filteredList: AppointmentsProps[];
  setActiveAppointment?: (inventory: AppointmentsProps) => void;
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
  const handleViewAppointment = (appointment: AppointmentsProps) => {
    setActiveAppointment?.(appointment);
    setViewPopup?.(true);
  };

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isSameDay(new Date(event.start), currentDate)
      ),
    [filteredList, currentDate]
  );

  return (
    <div className="border border-grey-light rounded-2xl w-full flex flex-col mb-10!">
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
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
