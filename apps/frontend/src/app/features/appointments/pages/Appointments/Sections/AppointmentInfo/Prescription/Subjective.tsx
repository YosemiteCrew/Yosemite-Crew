import React from "react";
import { Appointment } from "@yosemite-crew/types";
import { FormDataProps } from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo";
import PrescriptionFormSection from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/PrescriptionFormSection";

type SubjectiveProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
  canEdit: boolean;
};

const Subjective = ({
  activeAppointment,
  formData,
  setFormData,
  canEdit,
}: SubjectiveProps) => (
  <PrescriptionFormSection
    title="Subjective (history)"
    submissionsTitle="Previous subjective submissions"
    searchPlaceholder="Search"
    category="Prescription"
    formDataKey="subjective"
    formData={formData}
    setFormData={setFormData}
    activeAppointment={activeAppointment}
    canEdit={canEdit}
  />
);

export default Subjective;
