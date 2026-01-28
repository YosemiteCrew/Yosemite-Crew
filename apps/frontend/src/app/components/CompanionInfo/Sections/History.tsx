import React from "react";
import { CompanionParent } from "@/app/pages/Companions/types";
import AppointmentHistoryList from "@/app/components/Appointments/AppointmentHistoryList";

type HistoryType = {
  companion: CompanionParent;
};

const History = ({ companion }: HistoryType) => (
  <AppointmentHistoryList companionId={companion.companion.id} />
);

export default History;
