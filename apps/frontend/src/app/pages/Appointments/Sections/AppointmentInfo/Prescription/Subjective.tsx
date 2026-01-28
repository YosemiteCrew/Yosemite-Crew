import React from "react";
import { Appointment } from "@yosemite-crew/types";
import { FormDataProps } from "..";
import PrescriptionFormSection from "./PrescriptionFormSection";

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
    category="SOAP-Subjective"
    formDataKey="subjective"
    formData={formData}
    setFormData={setFormData}
    activeAppointment={activeAppointment}
    canEdit={canEdit}
  />
);

export default Subjective;
