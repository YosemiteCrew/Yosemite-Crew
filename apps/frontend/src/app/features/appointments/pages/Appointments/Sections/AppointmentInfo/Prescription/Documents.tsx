import React, { useMemo } from "react";
import { Appointment } from "@yosemite-crew/types";
import CompanionDocumentsSection from "@/app/features/documents/components/CompanionDocumentsSection";

type DocumentsType = {
  activeAppointment: Appointment;
};

const Documents = ({ activeAppointment }: DocumentsType) => {
  const companionId = useMemo(
    () => activeAppointment.companion.id,
    [activeAppointment],
  );
  return <CompanionDocumentsSection companionId={companionId} />;
};

export default Documents;
