import React from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import { IoArrowBack } from 'react-icons/io5';
import type { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, type ImageType } from '@/app/lib/urls';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import VisitTimer from '@/app/features/appointments/pages/AppointmentWorkspace/components/VisitTimer';

type PhonePatientBarProps = {
  appointment: Appointment;
  companionName: string;
  photoUrl?: string;
  speciesType?: string;
  /** Signalment pieces — breed, short age label, body weight (kg). */
  breed?: string;
  ageLabel?: string;
  weightKg?: number;
  /** Highlighted allergy tail, rendered in --danger-text when present. */
  allergy?: string;
  onBack: () => void;
  /** Best-available visit start for the header timer (#1903 binding, unchanged). */
  visitStartAt?: string | Date;
  bookedEndAt?: string | Date;
};

const SPECIES_IMAGE_TYPES = new Set<ImageType>(['dog', 'cat', 'horse', 'other']);

const resolveImageType = (speciesType?: string): ImageType => {
  const candidate = speciesType?.toLowerCase() as ImageType | undefined;
  return candidate && SPECIES_IMAGE_TYPES.has(candidate) ? candidate : 'dog';
};

const buildSignalment = (breed?: string, ageLabel?: string, weightKg?: number): string =>
  [breed, ageLabel, weightKg == null ? undefined : `${weightKg} kg`]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ');

/**
 * Compact phone patient header: 34px back circle, 38px species avatar, name + the
 * shared status pill, a truncating signalment line (allergy tail in --danger-text),
 * and a right-side running visit-timer pill. Presentation only — the timer is the
 * same VisitTimer bound to the same visitStartAt as the desktop header.
 */
const PhonePatientBar = ({
  appointment,
  companionName,
  photoUrl,
  speciesType,
  breed,
  ageLabel,
  weightKg,
  allergy,
  onBack,
  visitStartAt,
  bookedEndAt,
}: PhonePatientBarProps) => {
  const signalment = buildSignalment(breed, ageLabel, weightKg);
  const allergyText = (allergy ?? '').trim();

  return (
    <div className="flex flex-none items-center gap-2.5 border-b border-(--hairline) px-3.5 py-2.5">
      <button
        type="button"
        aria-label="Go back"
        onClick={onBack}
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-(--hairline) text-(--ink-soft) transition-colors duration-150 hover:bg-(--screen-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)"
      >
        <IoArrowBack size={15} aria-hidden="true" />
      </button>
      <AvatarImage
        src={getSafeImageUrl(photoUrl, resolveImageType(speciesType))}
        alt={companionName}
        size={38}
        className="size-[38px] shrink-0 rounded-full object-cover"
        fallback={
          <CompanionAvatar
            name={companionName}
            size={38}
            textClassName="text-[17px]"
            alt={companionName}
          />
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-bold tracking-[-0.02em] text-(--ink)">
            {companionName}
          </span>
          <AppointmentStatusPill appointment={appointment} />
        </div>
        <p className="truncate text-[10.5px] leading-tight text-(--ink-faint)">
          {signalment}
          {allergyText && (
            <>
              {signalment && ' · '}
              <span className="font-bold text-(--danger-text)">Allergy: {allergyText}</span>
            </>
          )}
        </p>
      </div>
      <VisitTimer variant="phone" startAt={visitStartAt} bookedEndAt={bookedEndAt} />
    </div>
  );
};

export default PhonePatientBar;
