import React from 'react';
import Image from 'next/image';
import { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { getStatusStyle } from '@/app/config/statusConfig';
import { toTitle } from '@/app/lib/validators';
import AppointmentDetailField from '@/app/features/appointments/components/AppointmentDetailField';
import {
  getAppointmentCompanionPhotoUrl,
  normalizeAppointmentStatus,
  type LegacyAppointmentStatus,
} from '@/app/lib/appointments';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';

type AppointmentCardContentProps = {
  appointment: Appointment;
};

const normalizeLeadId = (value?: string | null): string => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  return lowered === 'undefined' || lowered === 'null' ? '' : trimmed;
};

export const AppointmentCompanionHeader = ({ appointment }: AppointmentCardContentProps) => (
  <div className="flex gap-2 items-center">
    <Image
      alt=""
      src={getSafeImageUrl(
        getAppointmentCompanionPhotoUrl(appointment.companion),
        appointment.companion.species as ImageType
      )}
      height={40}
      width={40}
      className="h-10 w-10 rounded-full object-cover"
    />
    <div className="flex flex-col gap-0">
      <div className="text-body-3-emphasis text-text-primary">
        {formatCompanionNameWithOwnerLastName(
          appointment.companion?.name,
          appointment.companion?.parent
        )}
      </div>
      <div className="text-caption-1 text-text-primary">
        {getOwnerFirstName(appointment.companion?.parent)}
      </div>
    </div>
  </div>
);

export const AppointmentDetails = ({ appointment }: AppointmentCardContentProps) => {
  useLoadTeam();
  const teams = useTeamForPrimaryOrg();
  const leadId = normalizeLeadId(appointment.lead?.id);
  const fallbackLeadName = React.useMemo(() => {
    if (!leadId) return undefined;
    const matched = teams.find((team) => normalizeLeadId(team.practionerId) === leadId);
    return matched?.name?.trim() || undefined;
  }, [leadId, teams]);
  const leadName = appointment.lead?.name?.trim() || fallbackLeadName;

  return (
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
      <AppointmentDetailField
        label="Speciality"
        value={appointment.appointmentType?.speciality?.name}
      />
      <AppointmentDetailField label="Service" value={appointment.appointmentType?.name} />
      <AppointmentDetailField label="Room" value={appointment.room?.name} />
      <AppointmentDetailField label="Lead" value={leadName} />
      <AppointmentDetailField
        label="Staff"
        value={appointment.supportStaff?.map((sup) => sup.name).join(', ')}
      />
    </>
  );
};

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
