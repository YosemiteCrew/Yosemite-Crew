import React from "react";
import { CompanionParent } from "@/app/features/companions/pages/Companions/types";
import AppointmentHistoryList from "@/app/features/appointments/components/AppointmentHistoryList";

type HistoryType = {
  companion: CompanionParent;
};

const History = ({ companion }: HistoryType) => (
  <AppointmentHistoryList companionId={companion.companion.id} />
);

export default History;
