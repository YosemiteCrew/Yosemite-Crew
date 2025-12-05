import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { AppointmentsProps } from "@/app/types/appointments";
import React from "react";

type CompanionProps = {
  activeAppointment: AppointmentsProps;
};

const CompanionFields = [
  { label: "Date of birth", key: "dob", type: "text" },
  { label: "Gender", key: "gender", type: "text" },
  { label: "Weight", key: "weight", type: "text" },
  { label: "Blood group", key: "bloodGroup", type: "text" },
  { label: "Neutered status", key: "neuteured", type: "text" },
  { label: "Allergies", key: "allergies", type: "text" },
  { label: "Insurance number", key: "insuranceNumber", type: "text" },
];

const ParentFields = [
  { label: "Parent", key: "parent", type: "text" },
  { label: "Email", key: "email", type: "text" },
  { label: "Number", key: "number", type: "text" },
];

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
