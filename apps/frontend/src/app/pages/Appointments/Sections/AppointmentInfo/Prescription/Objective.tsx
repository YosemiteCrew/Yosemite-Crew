import React from "react";
import { Appointment } from "@yosemite-crew/types";
import { FormDataProps } from "..";
import PrescriptionFormSection from "./PrescriptionFormSection";

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
    category="SOAP-Objective"
    formDataKey="objective"
    formData={formData}
    setFormData={setFormData}
    activeAppointment={activeAppointment}
    canEdit={canEdit}
  />
);

export default Objective;
