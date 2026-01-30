import React from "react";
import { Appointment } from "@yosemite-crew/types";
import AppointmentHistoryList from "@/app/components/Appointments/AppointmentHistoryList";

type HistoryType = {
  activeAppointment: Appointment;
};

const History = ({ activeAppointment }: HistoryType) => (
  <AppointmentHistoryList companionId={activeAppointment.companion.id} />
);

export default History;
