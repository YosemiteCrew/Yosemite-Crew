import React from 'react';
import Image from 'next/image';
import { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { getAppointmentStatusTone } from '@/app/config/statusConfig';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { toTitle } from '@/app/lib/validators';
import AppointmentDetailField from '@/app/features/appointments/components/AppointmentDetailField';
import {
  getAppointmentCompanion,
  getAppointmentCompanionPhotoUrl,
  normalizeAppointmentStatus,
} from '@/app/lib/appointments';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { resolveEncounterMode } from '@/app/lib/appointmentWorkspace';
import type { EncounterMode } from '@/app/features/appointments/types/workspace';
import { IoBedOutline, IoFootstepsOutline } from 'react-icons/io5';

type AppointmentCardContentProps = {
  appointment: Appointment;
};

type AppointmentModePillProps = {
  appointment: Appointment;
  className?: string;
  iconSize?: number;
  tone?: 'default' | 'strong';
};

const normalizeLeadId = (value?: string | null): string => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  return lowered === 'undefined' || lowered === 'null' ? '' : trimmed;
};

export const AppointmentCompanionHeader = ({ appointment }: AppointmentCardContentProps) => (
  <div className="flex gap-2 items-center">
    {(() => {
      const companion = getAppointmentCompanion(appointment);
      return (
        <Image
          alt=""
          src={getSafeImageUrl(
            getAppointmentCompanionPhotoUrl(companion),
            companion.species as ImageType
          )}
          height={40}
          width={40}
          priority
          className="size-10 rounded-full object-cover"
        />
      );
    })()}
    <div className="flex flex-col gap-0">
      <div className="text-body-3-emphasis text-text-primary">
        {formatCompanionNameWithOwnerLastName(
          getAppointmentCompanion(appointment).name,
          getAppointmentCompanion(appointment).parent
        )}
      </div>
      <div className="text-caption-1 text-text-primary">
        {getOwnerFirstName(getAppointmentCompanion(appointment).parent)}
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
        value={`${getAppointmentCompanion(appointment).breed || '-'} / ${getAppointmentCompanion(appointment).species || '-'}`}
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
  const displayStatus = normalizeAppointmentStatus(appointment.status) ?? 'REQUESTED';
  return (
    <StatusPill
      tone={getAppointmentStatusTone(displayStatus)}
      label={toTitle(displayStatus)}
      className="w-fit"
    />
  );
};

export const AppointmentModePill = ({
  appointment,
  className = '',
  iconSize = 14,
}: AppointmentModePillProps) => {
  const mode: EncounterMode = resolveEncounterMode(appointment);
  const isInpatient = mode === 'INPATIENT';
  const label = isInpatient ? 'Inpatient' : 'Outpatient';

  return (
    <StatusPill
      tone={isInpatient ? 'info' : 'neutral'}
      title={label}
      className={className}
      label={
        <>
          {isInpatient ? (
            <IoBedOutline size={iconSize} aria-hidden="true" />
          ) : (
            <IoFootstepsOutline size={iconSize} aria-hidden="true" />
          )}
          <span className="whitespace-nowrap" style={{ color: 'inherit', opacity: 1 }}>
            {label}
          </span>
        </>
      }
    />
  );
};

const AppointmentCardContent = ({ appointment }: AppointmentCardContentProps) => (
  <>
    <AppointmentCompanionHeader appointment={appointment} />
    <AppointmentDetails appointment={appointment} />
    <AppointmentModePill appointment={appointment} className="w-fit self-start" />
    <AppointmentStatusBadge appointment={appointment} />
  </>
);

export default AppointmentCardContent;
