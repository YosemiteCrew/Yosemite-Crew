import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';
import { buildCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';

type HistoryType = {
  activeAppointment: Appointment;
  onOpenAppointmentView?: (intent: AppointmentViewIntent) => void;
};

const History = ({ activeAppointment, onOpenAppointmentView }: HistoryType) => (
  <CompanionHistoryTimeline
    companionId={activeAppointment.companion.id}
    activeAppointmentId={activeAppointment.id}
    onOpenAppointmentView={onOpenAppointmentView}
    compact
    fullPageHref={buildCompanionHistoryHref({
      companionId: activeAppointment.companion.id,
      source: 'appointments',
      appointmentId: activeAppointment.id,
      backTo: `/appointments?${new URLSearchParams({
        appointmentId: String(activeAppointment.id ?? '').trim(),
        open: 'info',
        subLabel: 'history',
      }).toString()}`,
    })}
  />
);

export default History;
