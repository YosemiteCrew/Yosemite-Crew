import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { AppointmentsProps } from "@/app/types/appointments";
import React from "react";

type CompanionProps = {
  activeAppointment: AppointmentsProps;
};

const CompanionFields = [{ label: "Service", key: "service", type: "text" }];

const ParentFields = [{ label: "Service", key: "service", type: "text" }];

const Companion = ({ activeAppointment }: CompanionProps) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        key={"companion-key"}
        title={"Companion details"}
        fields={CompanionFields}
        data={activeAppointment}
        defaultOpen={true}
      />
      <EditableAccordion
        key={"parent-key"}
        title={"Parent details"}
        fields={ParentFields}
        data={activeAppointment}
        defaultOpen={true}
      />
    </div>
  );
};

export default Companion;
