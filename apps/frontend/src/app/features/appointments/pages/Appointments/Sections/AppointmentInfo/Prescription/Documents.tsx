import React, { useMemo } from 'react';
import { Appointment } from '@yosemite-crew/types';
import CompanionDocumentsSection from '@/app/features/documents/components/CompanionDocumentsSection';
import { getAppointmentCompanion } from '@/app/lib/appointments';

type DocumentsType = {
  activeAppointment: Appointment;
};

const Documents = ({ activeAppointment }: DocumentsType) => {
  const companion = getAppointmentCompanion(activeAppointment);
  const companionId = useMemo(() => companion.id, [companion]);
  return <CompanionDocumentsSection companionId={companionId} />;
};

export default Documents;
