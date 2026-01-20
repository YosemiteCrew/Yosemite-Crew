"use client";
import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import AppointmentsTable from "../../components/DataTable/Appointments";
import AddAppointment from "./Sections/AddAppointment";
import AppoitmentInfo from "./Sections/AppointmentInfo";
import TitleCalendar from "@/app/components/TitleCalendar";
import AppointmentCalendar from "@/app/components/Calendar/AppointmentCalendar";
import { getStartOfWeek } from "@/app/components/Calendar/weekHelpers";
import OrgGuard from "@/app/components/OrgGuard";
import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";
import { Appointment } from "@yosemite-crew/types";
import Reschedule from "./Sections/Reschedule";
import { useSearchStore } from "@/app/stores/searchStore";
import Filters from "@/app/components/Filters/Filters";
import {
  AppointmentFilters,
  AppointmentStatusFilters,
} from "@/app/types/appointments";

const Appointments = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const query = useSearchStore((s) => s.query);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [reschedulePopup, setReschedulePopup] = useState(false);
  const [activeAppointment, setActiveAppointment] =
    useState<Appointment | null>(appointments[0] ?? null);
  const [activeCalendar, setActiveCalendar] = useState("day");
  const [activeView, setActiveView] = useState("calendar");
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

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return appointments.filter((item) => {
      const status = item.status?.toLowerCase();
      const filter = item.isEmergency && "emergencies";

      const matchesStatus = statusWanted === "all" || status === statusWanted;
      const matchesFilter = filterWanted === "all" || filter === filterWanted;
      const matchesQuery = !q || item.companion.name?.toLowerCase().includes(q);

      return matchesStatus && matchesFilter && matchesQuery;
    });
  }, [appointments, activeStatus, activeFilter, query]);

  return (
    <div className="flex flex-col relative">
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
          activeView={activeView}
          setActiveView={setActiveView}
        />

        <div className="w-full flex flex-col gap-3">
          <Filters
            filterOptions={AppointmentFilters}
            statusOptions={AppointmentStatusFilters}
            activeFilter={activeFilter}
            activeStatus={activeStatus}
            setActiveFilter={setActiveFilter}
            setActiveStatus={setActiveStatus}
          />
          {activeView === "calendar" ? (
            <AppointmentCalendar
              filteredList={filteredList}
              setActiveAppointment={setActiveAppointment}
              setViewPopup={setViewPopup}
              activeCalendar={activeCalendar}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              weekStart={weekStart}
              setWeekStart={setWeekStart}
              setReschedulePopup={setReschedulePopup}
            />
          ) : (
            <AppointmentsTable
              filteredList={filteredList}
              setActiveAppointment={setActiveAppointment}
              setViewPopup={setViewPopup}
              setReschedulePopup={setReschedulePopup}
            />
          )}
        </div>

        <AddAppointment showModal={addPopup} setShowModal={setAddPopup} />
        {activeAppointment && (
          <AppoitmentInfo
            showModal={viewPopup}
            setShowModal={setViewPopup}
            activeAppointment={activeAppointment}
          />
        )}
        {activeAppointment && (
          <Reschedule
            showModal={reschedulePopup}
            setShowModal={setReschedulePopup}
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
