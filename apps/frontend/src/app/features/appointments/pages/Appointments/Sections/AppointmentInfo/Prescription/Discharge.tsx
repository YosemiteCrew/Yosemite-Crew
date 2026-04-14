import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { FormDataProps } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo';
import PrescriptionFormSection from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/PrescriptionFormSection';

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
    category="Discharge Form"
    formDataKey="discharge"
    formData={formData}
    setFormData={setFormData}
    activeAppointment={activeAppointment}
    canEdit={canEdit}
  />
);

export default Discharge;
