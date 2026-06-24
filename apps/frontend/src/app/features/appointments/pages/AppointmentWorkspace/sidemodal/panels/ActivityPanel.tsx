'use client';
import React from 'react';
import type { Appointment } from '@yosemite-crew/types';
import Audit from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit';

type ActivityPanelProps = {
  appointment: Appointment;
};

/** Activity panel — reuses the existing appointment Audit trail component. */
const ActivityPanel = ({ appointment }: ActivityPanelProps) => (
  <Audit activeAppointment={appointment} />
);

export default ActivityPanel;
