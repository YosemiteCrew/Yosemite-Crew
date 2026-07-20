import Image from 'next/image';
import React from 'react';
import { IoCalendarOutline, IoEye, IoListOutline, IoSyncOutline } from 'react-icons/io5';
import { getCompanionStatusStyle } from '@/app/ui/tables/tableUtils';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { formatCompanionAge } from '@/app/lib/date';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { toTitleCase } from '@/app/lib/validators';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

const GENDER_LABEL: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Unknown',
};

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
  const terminologyText = useCompanionTerminologyText();
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] p-3 flex flex-col justify-between gap-2 cursor-pointer">
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
          className="size-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-body-3-emphasis text-text-primary">
            {formatCompanionNameWithOwnerLastName(companion.companion.name, companion.parent)}
          </div>
          <div className="text-caption-1 text-text-primary">
            {companion.companion.breed +
              ' / ' +
              (SPECIES_LABEL[companion.companion.type?.toLowerCase()] ??
                toTitleCase(companion.companion.type))}
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
          {(GENDER_LABEL[companion.companion.gender?.toLowerCase()] ??
            toTitleCase(companion.companion.gender)) +
            ' - ' +
            (formatCompanionAge(companion.companion.dateOfBirth) || '-')}
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
        style={getCompanionStatusStyle(companion.companion.status || 'inactive')}
        className="appointment-status"
      >
        {toTitleCase(companion.companion.status || 'inactive')}
      </div>
      <div className="flex gap-2 justify-center">
        <GlassTooltip content={terminologyText('View companion')} side="top">
          <button
            type="button"
            onClick={() => handleViewCompanion(companion)}
            aria-label={`${terminologyText('View companion')} ${companion.companion.name}`}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="var(--color-neutral-900)" />
          </button>
        </GlassTooltip>
        {canEditCompanions && (
          <GlassTooltip content="Change status" side="top">
            <button
              type="button"
              onClick={() => handleChangeStatus(companion)}
              aria-label={`Change status for ${companion.companion.name}`}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <IoSyncOutline size={18} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
        )}
        {canEditAppointments && (
          <GlassTooltip content="Schedule" side="top">
            <button
              type="button"
              onClick={() => handleBookAppointment(companion)}
              aria-label={`Schedule ${companion.companion.name}`}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <IoCalendarOutline size={14} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
        )}
        {canEditTasks && (
          <GlassTooltip content="Task" side="top">
            <button
              type="button"
              onClick={() => handleAddTask(companion)}
              aria-label={`Create task for ${companion.companion.name}`}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <IoListOutline size={14} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
        )}
      </div>
    </div>
  );
};

export default CompanionCard;
