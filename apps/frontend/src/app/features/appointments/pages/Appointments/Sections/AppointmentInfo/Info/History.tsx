import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';

type HistoryType = {
  activeAppointment: Appointment;
  onOpenAppointmentView?: (intent: AppointmentViewIntent) => void;
};

const History = ({ activeAppointment, onOpenAppointmentView }: HistoryType) => (
  <CompanionHistoryTimeline
    companionId={activeAppointment.companion.id}
    activeAppointmentId={activeAppointment.id}
    onOpenAppointmentView={onOpenAppointmentView}
  />
);

export default History;
