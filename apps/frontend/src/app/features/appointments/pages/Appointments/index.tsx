"use client";
import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import AppointmentsTable from "@/app/ui/tables/Appointments";
import AddAppointment from "@/app/features/appointments/pages/Appointments/Sections/AddAppointment";
import AppoitmentInfo from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo";
import TitleCalendar from "@/app/ui/widgets/TitleCalendar";
import AppointmentCalendar from "@/app/features/appointments/components/Calendar/AppointmentCalendar";
import { getStartOfWeek } from "@/app/features/appointments/components/Calendar/weekHelpers";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";
import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";
import { Appointment } from "@yosemite-crew/types";
import Reschedule from "@/app/features/appointments/pages/Appointments/Sections/Reschedule";
import ChangeStatus from "@/app/features/appointments/pages/Appointments/Sections/ChangeStatus";
import { useSearchStore } from "@/app/stores/searchStore";
import Filters from "@/app/ui/filters/Filters";
import {
  AppointmentFilters,
  AppointmentStatusFiltersUI,
} from "@/app/features/appointments/types/appointments";
import { AppointmentViewIntent } from "@/app/features/appointments/types/calendar";
import { usePermissions } from "@/app/hooks/usePermissions";
import { PERMISSIONS } from "@/app/lib/permissions";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import Fallback from "@/app/ui/overlays/Fallback";

const Appointments = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditAppointments = can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const query = useSearchStore((s) => s.query);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [viewIntent, setViewIntent] = useState<AppointmentViewIntent | null>(null);
  const [reschedulePopup, setReschedulePopup] = useState(false);
  const [changeStatusPopup, setChangeStatusPopup] = useState(false);
  const [activeAppointment, setActiveAppointment] =
    useState<Appointment | null>(appointments[0] ?? null);
  const [activeCalendar, setActiveCalendar] = useState("week");
  const [activeView, setActiveView] = useState("calendar");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(getStartOfWeek(currentDate));

  useEffect(() => {
    setWeekStart(getStartOfWeek(currentDate));
  }, [currentDate, activeCalendar]);

  useEffect(() => {
    if (!viewPopup) {
      setViewIntent(null);
    }
  }, [viewPopup]);

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

      const matchesStatus =
        statusWanted === "all" ||
        status === statusWanted ||
        (statusWanted === "requested" && status === "no_payment");
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
          showAdd={canEditAppointments}
        />

        <PermissionGate
          allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY]}
          fallback={<Fallback />}
        >
          <div className="w-full flex flex-col gap-3">
            <Filters
              filterOptions={AppointmentFilters}
              statusOptions={AppointmentStatusFiltersUI}
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
                setViewIntent={setViewIntent}
                setChangeStatusPopup={setChangeStatusPopup}
                activeCalendar={activeCalendar}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                weekStart={weekStart}
                setWeekStart={setWeekStart}
                setReschedulePopup={setReschedulePopup}
                canEditAppointments={canEditAppointments}
              />
            ) : (
              <AppointmentsTable
                filteredList={filteredList}
                setActiveAppointment={setActiveAppointment}
                setViewPopup={setViewPopup}
                setViewIntent={setViewIntent}
                setReschedulePopup={setReschedulePopup}
                setChangeStatusPopup={setChangeStatusPopup}
                canEditAppointments={canEditAppointments}
              />
            )}
          </div>

          <AddAppointment
            showModal={addPopup}
            setShowModal={setAddPopup}
            setActiveFilter={setActiveFilter}
            setActiveStatus={setActiveStatus}
          />
          {activeAppointment && (
            <AppoitmentInfo
              showModal={viewPopup}
              setShowModal={setViewPopup}
              activeAppointment={activeAppointment}
              initialViewIntent={viewIntent}
            />
          )}
          {canEditAppointments && activeAppointment && (
            <Reschedule
              showModal={reschedulePopup}
              setShowModal={setReschedulePopup}
              activeAppointment={activeAppointment}
            />
          )}
          {canEditAppointments && activeAppointment && (
            <ChangeStatus
              showModal={changeStatusPopup}
              setShowModal={setChangeStatusPopup}
              activeAppointment={activeAppointment}
            />
          )}
        </PermissionGate>
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
