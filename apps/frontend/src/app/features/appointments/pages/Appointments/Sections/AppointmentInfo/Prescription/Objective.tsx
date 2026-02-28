import React from "react";
import { Appointment } from "@yosemite-crew/types";
import { FormDataProps } from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo";
import PrescriptionFormSection from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/PrescriptionFormSection";

type ObjectiveProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
  canEdit: boolean;
};

const Objective = ({
  activeAppointment,
  formData,
  setFormData,
  canEdit,
}: ObjectiveProps) => (
  <PrescriptionFormSection
    title="Objective (clinical examination)"
    submissionsTitle="Previous objective submissions"
    searchPlaceholder="Search"
    category="Prescription"
    formDataKey="objective"
    formData={formData}
    setFormData={setFormData}
    activeAppointment={activeAppointment}
    canEdit={canEdit}
  />
);

export default Objective;
