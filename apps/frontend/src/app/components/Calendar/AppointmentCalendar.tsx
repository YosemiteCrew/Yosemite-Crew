import { AppointmentsProps } from "@/app/types/appointments";
import React, { useMemo, useState } from "react";
import { isSameDay } from "./helpers";
import DayCalendar from "./common/DayCalendar";
import Header from "./common/Header";
import WeekCalendar from "./common/WeekCalendar";
import { getStartOfWeek } from "./weekHelpers";

type AppointmentCalendarProps = {
  filteredList: AppointmentsProps[];
  setActiveAppointment?: (inventory: AppointmentsProps) => void;
  setViewPopup?: (open: boolean) => void;
  activeCalendar: string;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const AppointmentCalendar = ({
  filteredList,
  setActiveAppointment,
  setViewPopup,
  activeCalendar,
  currentDate,
  setCurrentDate,
}: AppointmentCalendarProps) => {
  const handleViewAppointment = (appointment: AppointmentsProps) => {
    setActiveAppointment?.(appointment);
    setViewPopup?.(true);
  };
  const [weekStart, setWeekStart] = useState(
    getStartOfWeek(new Date("2025-12-01"))
  );

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isSameDay(new Date(event.start), currentDate)
      ),
    [filteredList, currentDate]
  );

  return (
    <div className="border border-grey-light rounded-2xl h-[800px] w-full flex flex-col mb-10!">
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
          events={dayEvents}
          date={currentDate}
          handleViewAppointment={handleViewAppointment}
          weekStart={currentDate}
          setWeekStart={setCurrentDate}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
