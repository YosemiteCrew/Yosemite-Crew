import Image from 'next/image';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import React from 'react';
import { Team } from '@/app/features/organization/types/team';
import { getSafeImageUrl } from '@/app/lib/urls';
import {
  formatWeeklyWorkingHours,
  getAvailabilityStatusTone,
  toSpecialityNames,
} from '@/app/ui/tables/tableUtils';
import { toTitleCase } from '@/app/lib/validators';
import { Secondary } from '@/app/ui/primitives/Buttons';

type AvailabilityCardProps = {
  team: Team;
  handleViewTeam: any;
};

const AvailabilityCard = ({ team, handleViewTeam }: AvailabilityCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] p-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-2 items-center">
        <div className="size-10">
          <Image
            alt={''}
            src={getSafeImageUrl(team.image, 'person')}
            height={40}
            width={40}
            className="size-10 rounded-full object-cover"
          />
        </div>
        <div className="flex flex-col gap-0">
          <div className="text-body-3-emphasis text-text-primary">{team.name}</div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Role:</div>
        <div className="text-caption-1 text-text-primary">{toTitleCase(team.role)}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Speciality:</div>
        <div className="text-caption-1 text-text-primary">
          {/* Shares the table's reader so the phone card and the desktop row can
              never disagree about a team's specialities. It also replaces the
              old JSON.stringify fallback, which printed `{"code":"X1"}` at a
              clinician. */}
          {toSpecialityNames(team?.speciality).join(', ') || '-'}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Today&apos;s Appointment:</div>
        <div className="text-caption-1 text-text-primary">{team.todayAppointment}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Weekly working hours:</div>
        <div className="text-caption-1 text-text-primary">
          {formatWeeklyWorkingHours(team.weeklyWorkingHours)}
        </div>
      </div>
      <StatusPill tone={getAvailabilityStatusTone(team.status)} label={team.status} />
      <Secondary href="#" onClick={() => handleViewTeam(team)} text="View" className="w-full" />
    </div>
  );
};

export default AvailabilityCard;
