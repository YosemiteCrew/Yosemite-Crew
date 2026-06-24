'use client';
import React from 'react';
import type { Appointment } from '@yosemite-crew/types';
import Chat from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/Chat';

type ChatPanelProps = {
  appointment: Appointment;
};

/** Chat panel — reuses the existing appointment Chat component. */
const ChatPanel = ({ appointment }: ChatPanelProps) => <Chat activeAppointment={appointment} />;

export default ChatPanel;
