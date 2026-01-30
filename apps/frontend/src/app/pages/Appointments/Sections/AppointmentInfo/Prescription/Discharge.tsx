import React from "react";
import { Appointment } from "@yosemite-crew/types";
import { FormDataProps } from "..";
import PrescriptionFormSection from "./PrescriptionFormSection";

type DischargeSummaryProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
  canEdit: boolean;
};

const Discharge = ({
  activeAppointment,
  formData,
  setFormData,
  canEdit,
}: DischargeSummaryProps) => (
  <PrescriptionFormSection
    title="Discharge summary"
    submissionsTitle="Previous discharge submissions"
    searchPlaceholder="Search"
    category="Discharge"
    formDataKey="discharge"
    formData={formData}
    setFormData={setFormData}
    activeAppointment={activeAppointment}
    canEdit={canEdit}
  />
);

export default Discharge;
