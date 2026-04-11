import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { FormDataProps } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo';
import PrescriptionFormSection from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/PrescriptionFormSection';

type AssessmentProps = {
  activeAppointment: Appointment;
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  canEdit: boolean;
};

const Assessment = ({ activeAppointment, formData, setFormData, canEdit }: AssessmentProps) => {
  return (
    <PrescriptionFormSection
      title="Assessment (diagnosis)"
      submissionsTitle="Previous assessment submissions"
      searchPlaceholder="Search"
      category="SOAP"
      formDataKey="assessment"
      formData={formData}
      setFormData={setFormData}
      activeAppointment={activeAppointment}
      canEdit={canEdit}
    />
  );
};

export default Assessment;
