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
    compact
    fullPageHref={`/companions/history?${(() => {
      const appointmentId = String(activeAppointment.id ?? '').trim();
      const backTo = `/appointments?${new URLSearchParams({
        appointmentId,
        open: 'info',
        subLabel: 'history',
      }).toString()}`;
      return new URLSearchParams({
        companionId: activeAppointment.companion.id,
        source: 'appointments',
        appointmentId,
        backTo,
      }).toString();
    })()}`}
  />
);

export default History;
