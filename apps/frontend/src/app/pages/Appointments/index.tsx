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

const Appointments = () => {
  const appointments = useAppointmentsForPrimaryOrg();
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
        if (updated) return { ...updated };
      }
      return appointments[0];
    });
  }, [appointments]);

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <TitleCalendar
        activeCalendar={activeCalendar}
        title="Appointments"
        setActiveCalendar={setActiveCalendar}
        setAddPopup={setAddPopup}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
      />

      <div className="w-full flex flex-col gap-6">
        <AppointmentFilters list={appointments} setFilteredList={setFilteredList} />
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

      <AddAppointment showModal={addPopup} setShowModal={setAddPopup} />
      {activeAppointment && (
        <AppoitmentInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeAppointment={activeAppointment}
        />
      )}
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
