import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Appointment } from '@yosemite-crew/types';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import EmergencyBadge from '@/app/features/appointments/components/EmergencyBadge';
import { AppointmentModePill } from '@/app/features/appointments/components/AppointmentCardContent';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import {
  CompanionWeightSource,
  getCompanionAge,
  getCompanionGenderLabel,
  getCompanionWeightLabel,
  PopoverCompanion,
  SPECIES_DISPLAY,
} from '@/app/features/appointments/components/Calendar/common/appointmentPopoverHelpers';

type PopoverHeaderProps = {
  appointment: Appointment;
  companion: PopoverCompanion;
  companionDetails: CompanionWeightSource & Appointment['companion'];
  companionDisplayName: string;
  canEditAppointments: boolean;
  titleId: string;
  registerAnchorEl: (el: HTMLElement | null) => () => void;
  onClose: () => void;
};

const PopoverHeader = ({
  appointment,
  companion,
  companionDetails,
  companionDisplayName,
  canEditAppointments,
  titleId,
  registerAnchorEl,
  onClose,
}: PopoverHeaderProps) => {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-card-border pb-4">
      <div className="min-w-0 flex items-center gap-3">
        <Image
          src={getSafeImageUrl(
            getAppointmentCompanionPhotoUrl(companion),
            companion.species.toLowerCase() as ImageType
          )}
          height={48}
          width={48}
          className="flex aspect-square size-12 shrink-0 items-center justify-center rounded-full border border-card-border bg-neutral-0 object-cover"
          style={{ width: 48, height: 48 }}
          alt=""
        />
        <div className="min-w-0">
          <button
            type="button"
            id={titleId}
            className="block max-w-full truncate text-[17px] font-bold text-[var(--ink)] cursor-pointer underline-offset-2 hover:underline"
            onClick={() => {
              router.push(
                buildAppointmentCompanionHistoryHref(appointment.id, companion.id, '/appointments')
              );
              onClose();
            }}
            title="Open appointment overview"
          >
            {companionDisplayName}
          </button>
          <div className="mt-1 line-clamp-2 text-left text-[12px] text-[var(--ink-faint)] wrap-break-word">
            {(() => {
              const c = companionDetails as typeof companionDetails & {
                gender?: string;
                dateOfBirth?: Date;
                isneutered?: boolean;
              };
              const rawSpecies = companionDetails.species || '';
              const speciesLabel = (SPECIES_DISPLAY[rawSpecies.toLowerCase()] ?? rawSpecies) || '-';
              const parts: string[] = [];
              const breed = companionDetails.breed;
              if (breed) parts.push(breed);
              if (speciesLabel) parts.push(speciesLabel);
              const age = getCompanionAge(c.dateOfBirth);
              if (age) parts.push(age);
              parts.push(getCompanionGenderLabel(c.gender, c.isneutered));
              const weight = getCompanionWeightLabel(companionDetails);
              if (weight) parts.push(weight);
              return parts.join(' · ');
            })()}
          </div>
        </div>
      </div>

      {/* Status pill — shared component (dropdown trigger when changeable). */}
      <div className="relative shrink-0 flex flex-col items-end gap-1.5">
        <AppointmentStatusPill
          appointment={appointment}
          canEdit={canEditAppointments}
          onChanged={onClose}
          registerAnchorEl={registerAnchorEl}
        />
        <AppointmentModePill appointment={appointment} className="w-fit" />

        {appointment.isEmergency && <EmergencyBadge />}
      </div>
    </div>
  );
};

export default PopoverHeader;
