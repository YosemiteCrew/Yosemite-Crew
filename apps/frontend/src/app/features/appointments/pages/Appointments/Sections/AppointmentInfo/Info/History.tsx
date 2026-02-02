import React from "react";
import { Appointment } from "@yosemite-crew/types";
import AppointmentHistoryList from "@/app/features/appointments/components/AppointmentHistoryList";

type HistoryType = {
  activeAppointment: Appointment;
};

const History = ({ activeAppointment }: HistoryType) => (
  <AppointmentHistoryList companionId={activeAppointment.companion.id} />
);

export default History;
