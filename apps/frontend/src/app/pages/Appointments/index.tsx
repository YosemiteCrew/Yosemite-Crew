"use client";
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import AppointmentsTable from "../../components/DataTable/Appointments";
import { AppointmentsProps } from "@/app/types/appointments";
import { demoAppointments } from "./demo";
import AppointmentFilters from "@/app/components/Filters/AppointmentFilters";
import AddAppointment from "./Sections/AddAppointment";
import AppoitmentInfo from "./Sections/AppointmentInfo";
import TitleCalendar from "@/app/components/TitleCalendar";

const Appointments = () => {
  const [list] = useState<AppointmentsProps[]>(demoAppointments);
  const [filteredList, setFilteredList] =
    useState<AppointmentsProps[]>(demoAppointments);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeAppointment, setActiveAppointment] =
    useState<AppointmentsProps | null>(demoAppointments[0] ?? null);
  const [activeCalendar, setActiveCalendar] = useState(2);

  useEffect(() => {
    if (filteredList.length > 0) {
      setActiveAppointment(filteredList[0]);
    } else {
      setActiveAppointment(null);
    }
  }, [filteredList]);

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <TitleCalendar
        activeCalendar={activeCalendar}
        title="Appointments"
        setActiveCalendar={setActiveCalendar}
        setAddPopup={setAddPopup}
      />

      <div className="w-full flex flex-col gap-6">
        <AppointmentFilters list={list} setFilteredList={setFilteredList} />
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
      <Appointments />
    </ProtectedRoute>
  );
};

export default ProtectedAppoitments;
