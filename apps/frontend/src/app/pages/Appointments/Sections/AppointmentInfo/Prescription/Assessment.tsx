import React from "react";
import { Appointment } from "@yosemite-crew/types";
import { FormDataProps } from "..";
import PrescriptionFormSection from "./PrescriptionFormSection";

type AssessmentProps = {
  activeAppointment: Appointment;
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  canEdit: boolean;
};

const Assessment = ({
  activeAppointment,
  formData,
  setFormData,
  canEdit,
}: AssessmentProps) => {
  return (
    <PrescriptionFormSection
      title="Assessment (diagnosis)"
      submissionsTitle="Previous assessment submissions"
      searchPlaceholder="Search"
      category="SOAP-Assessment"
      formDataKey="assessment"
      formData={formData}
      setFormData={setFormData}
      activeAppointment={activeAppointment}
      canEdit={canEdit}
    />
  );
};

export default Assessment;
