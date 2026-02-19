import React, { useMemo } from "react";
import { isSameDay } from "@/app/features/appointments/components/Calendar/helpers";
import DayCalendar from "@/app/features/appointments/components/Calendar/common/DayCalendar";
import Header from "@/app/features/appointments/components/Calendar/common/Header";
import WeekCalendar from "@/app/features/appointments/components/Calendar/common/WeekCalendar";
import { Appointment } from "@yosemite-crew/types";
import UserCalendar from "@/app/features/appointments/components/Calendar/common/UserCalendar";
import { AppointmentViewIntent } from "@/app/features/appointments/types/calendar";

type AppointmentCalendarProps = {
  filteredList: Appointment[];
  setActiveAppointment?: (inventory: Appointment) => void;
  setViewPopup?: (open: boolean) => void;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  setChangeStatusPopup?: (open: boolean) => void;
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
  setViewIntent,
  setChangeStatusPopup,
  activeCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  setReschedulePopup,
  canEditAppointments
}: AppointmentCalendarProps) => {
  const handleViewAppointment = (
    appointment: Appointment,
    intent?: AppointmentViewIntent,
  ) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(intent ?? null);
    setViewPopup?.(true);
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setReschedulePopup?.(true);
  };

  const handleChangeStatusAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setChangeStatusPopup?.(true);
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
          handleChangeStatusAppointment={handleChangeStatusAppointment}
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
          handleChangeStatusAppointment={handleChangeStatusAppointment}
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
          handleChangeStatusAppointment={handleChangeStatusAppointment}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
