import React from 'react';
import Image from 'next/image';
import { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { getStatusStyle } from '@/app/config/statusConfig';
import { toTitle } from '@/app/lib/validators';
import AppointmentDetailField from '@/app/features/appointments/components/AppointmentDetailField';
import { normalizeAppointmentStatus, type LegacyAppointmentStatus } from '@/app/lib/appointments';

type AppointmentCardContentProps = {
  appointment: Appointment;
};

export const AppointmentCompanionHeader = ({ appointment }: AppointmentCardContentProps) => (
  <div className="flex gap-2 items-center">
    <Image
      alt=""
      src={getSafeImageUrl('', appointment.companion.species as ImageType)}
      height={40}
      width={40}
      style={{ borderRadius: '50%' }}
      className="h-10 w-10 rounded-full"
    />
    <div className="flex flex-col gap-0">
      <div className="text-body-3-emphasis text-text-primary">{appointment.companion?.name}</div>
      <div className="text-caption-1 text-text-primary">{appointment.companion?.parent?.name}</div>
    </div>
  </div>
);

export const AppointmentDetails = ({ appointment }: AppointmentCardContentProps) => (
  <>
    <AppointmentDetailField
      label="Breed / Species"
      value={`${appointment.companion?.breed || '-'} / ${appointment.companion?.species}`}
    />
    <AppointmentDetailField
      label="Date / Time"
      value={`${formatDateLabel(appointment.appointmentDate)} / ${formatTimeLabel(appointment.startTime)}`}
    />
    <AppointmentDetailField label="Reason" value={appointment.concern} />
    <AppointmentDetailField label="Service" value={appointment.appointmentType?.name} />
    <AppointmentDetailField label="Room" value={appointment.room?.name} />
    <AppointmentDetailField label="Lead" value={appointment.lead?.name} />
    <AppointmentDetailField
      label="Staff"
      value={appointment.supportStaff?.map((sup) => sup.name).join(', ')}
    />
  </>
);

export const AppointmentStatusBadge = ({ appointment }: AppointmentCardContentProps) => {
  const displayStatus =
    normalizeAppointmentStatus(appointment.status as LegacyAppointmentStatus) ?? 'REQUESTED';
  return (
    <div
      style={getStatusStyle(displayStatus)}
      className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
    >
      {toTitle(displayStatus)}
    </div>
  );
};

const AppointmentCardContent = ({ appointment }: AppointmentCardContentProps) => (
  <>
    <AppointmentCompanionHeader appointment={appointment} />
    <AppointmentDetails appointment={appointment} />
    <AppointmentStatusBadge appointment={appointment} />
  </>
);

export default AppointmentCardContent;
