import Image from 'next/image';
import React from 'react';
import { FaCalendar, FaTasks } from 'react-icons/fa';
import { IoEye } from 'react-icons/io5';
import { MdOutlineAutorenew } from 'react-icons/md';
import { getStatusStyle } from '@/app/ui/tables/CompanionsTable';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { getAgeInYears } from '@/app/lib/date';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { toTitleCase } from '@/app/lib/validators';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';

type CompanionCardProps = {
  companion: CompanionParent;
  handleViewCompanion: (companion: CompanionParent) => void;
  handleBookAppointment: (companion: CompanionParent) => void;
  handleAddTask: (companion: CompanionParent) => void;
  handleChangeStatus: (companion: CompanionParent) => void;
  canEditAppointments: boolean;
  canEditTasks: boolean;
  canEditCompanions: boolean;
};

const CompanionCard = ({
  companion,
  handleViewCompanion,
  handleBookAppointment,
  handleAddTask,
  handleChangeStatus,
  canEditAppointments,
  canEditTasks,
  canEditCompanions,
}: CompanionCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-2 items-center">
        <Image
          alt={''}
          src={getSafeImageUrl(
            companion.companion.photoUrl,
            companion.companion.type.toLowerCase() as ImageType
          )}
          height={40}
          width={40}
          style={{ borderRadius: '50%' }}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-body-3-emphasis text-text-primary">
            {formatCompanionNameWithOwnerLastName(companion.companion.name, companion.parent)}
          </div>
          <div className="text-caption-1 text-text-primary">
            {companion.companion.breed + ' / ' + companion.companion.type}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Parent / Co-parent:</div>
        <div className="text-caption-1 text-text-primary">{companion.parent.firstName}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Gender / Age:</div>
        <div className="text-caption-1 text-text-primary">
          {companion.companion.gender + ' - ' + getAgeInYears(companion.companion.dateOfBirth)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Allergies:</div>
        <div className="text-caption-1 text-text-primary">{companion.companion.allergy || '-'}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Upcoming appointment:</div>
        <div className="text-caption-1 text-text-primary">{'-'}</div>
      </div>
      <div
        style={getStatusStyle(companion.companion.status || 'inactive')}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {toTitleCase(companion.companion.status || 'inactive')}
      </div>
      <div className="flex gap-2 justify-center">
        <GlassTooltip content="View" side="top">
          <button
            onClick={() => handleViewCompanion(companion)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="#302F2E" />
          </button>
        </GlassTooltip>
        {canEditCompanions && (
          <GlassTooltip content="Change status" side="top">
            <button
              onClick={() => handleChangeStatus(companion)}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <MdOutlineAutorenew size={18} color="#302F2E" />
            </button>
          </GlassTooltip>
        )}
        {canEditAppointments && (
          <GlassTooltip content="Schedule" side="top">
            <button
              onClick={() => handleBookAppointment(companion)}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <FaCalendar size={14} color="#302F2E" />
            </button>
          </GlassTooltip>
        )}
        {canEditTasks && (
          <GlassTooltip content="Task" side="top">
            <button
              onClick={() => handleAddTask(companion)}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <FaTasks size={14} color="#302F2E" />
            </button>
          </GlassTooltip>
        )}
      </div>
    </div>
  );
};

export default CompanionCard;
