"use client";
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import AppointmentsTable from "../../components/DataTable/Appointments";
import AppointmentFilters from "@/app/components/Filters/AppointmentFilters";
import AddAppointment from "./Sections/AddAppointment";
import AppoitmentInfo from "./Sections/AppointmentInfo";
import TitleCalendar from "@/app/components/TitleCalendar";
import AppointmentCalendar from "@/app/components/Calendar/AppointmentCalendar";
import { getStartOfWeek } from "@/app/components/Calendar/weekHelpers";
import OrgGuard from "@/app/components/OrgGuard";
import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";
import { Appointment } from "@yosemite-crew/types";
import { useErrorTost } from "@/app/components/Toast/Toast";

const Appointments = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const [filteredList, setFilteredList] = useState<Appointment[]>(appointments);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeAppointment, setActiveAppointment] =
    useState<Appointment | null>(appointments[0] ?? null);
  const [activeCalendar, setActiveCalendar] = useState("day");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(getStartOfWeek(currentDate));

  useEffect(() => {
    setWeekStart(getStartOfWeek(currentDate));
  }, [currentDate, activeCalendar]);

  useEffect(() => {
    setActiveAppointment((prev) => {
      if (appointments.length === 0) return null;
      if (prev?.id) {
        const updated = appointments.find((s) => s.id === prev.id);
        if (updated) return updated;
      }
      return appointments[0];
    });
  }, [appointments]);

  return (
    <div className="flex flex-col relative">
      {ErrorTostPopup}
      <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
        <TitleCalendar
          activeCalendar={activeCalendar}
          title="Appointments"
          description="Schedule and manage appointments across day, week, and team views, then drill into tasks, chat, and billing details for each visit."
          setActiveCalendar={setActiveCalendar}
          setAddPopup={setAddPopup}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          count={appointments.length}
        />

        <div className="w-full flex flex-col gap-3">
          <AppointmentFilters
            list={appointments}
            setFilteredList={setFilteredList}
          />
          <AppointmentCalendar
            filteredList={appointments}
            setActiveAppointment={setActiveAppointment}
            setViewPopup={setViewPopup}
            activeCalendar={activeCalendar}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
          />
          <AppointmentsTable
            filteredList={filteredList}
            setActiveAppointment={setActiveAppointment}
            setViewPopup={setViewPopup}
          />
        </div>

        <AddAppointment
          showModal={addPopup}
          setShowModal={setAddPopup}
          showErrorTost={showErrorTost}
        />
        {activeAppointment && (
          <AppoitmentInfo
            showModal={viewPopup}
            setShowModal={setViewPopup}
            activeAppointment={activeAppointment}
          />
        )}
      </div>
    </div>
  );
};

const ProtectedAppoitments = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Appointments />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedAppoitments;
