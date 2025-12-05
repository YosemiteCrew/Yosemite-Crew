import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { AppointmentsProps } from "@/app/types/appointments";
import React from "react";

const AppointmentFields = [
  { label: "Service", key: "service", type: "text" },
  { label: "Reason", key: "reason", type: "text" },
  { label: "Room", key: "room", type: "text" },
  { label: "Parent", key: "parentName", type: "text" },
  { label: "Date", key: "date", type: "text" },
  { label: "Time", key: "time", type: "text" },
  { label: "Status", key: "status", type: "text" },
];

const StaffFields = [
  { label: "Lead", key: "lead", type: "text" },
  { label: "Support", key: "support", type: "text" },
];

const BillingFields = [{ label: "Service", key: "service", type: "text" }];

type AppointmentInfoProps = {
  activeAppointment: AppointmentsProps;
};

const Appointment = ({ activeAppointment }: AppointmentInfoProps) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        key={"Appointments-key"}
        title={"Appointments details"}
        fields={AppointmentFields}
        data={activeAppointment}
        defaultOpen={true}
      />
      <EditableAccordion
        key={"staff-key"}
        title={"Staff details"}
        fields={StaffFields}
        data={activeAppointment}
        defaultOpen={true}
      />
      <EditableAccordion
        key={"billing-key"}
        title={"Billing details"}
        fields={BillingFields}
        data={activeAppointment}
        defaultOpen={true}
      />
    </div>
  );
};

export default Appointment;
