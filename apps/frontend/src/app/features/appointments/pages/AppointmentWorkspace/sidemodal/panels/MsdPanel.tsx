'use client';
import React from 'react';
import type { Appointment } from '@yosemite-crew/types';
import AppointmentMerckSearch from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch';

type MsdPanelProps = {
  appointment: Appointment;
};

/** MSD panel — reuses the existing appointment Merck search component. */
const MsdPanel = ({ appointment }: MsdPanelProps) => (
  <AppointmentMerckSearch activeAppointment={appointment} />
);

export default MsdPanel;
