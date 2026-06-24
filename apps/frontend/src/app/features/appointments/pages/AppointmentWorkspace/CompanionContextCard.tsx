import React from 'react';
import Image from 'next/image';
import { LuChevronRight, LuFootprints } from 'react-icons/lu';
import { TbBed } from 'react-icons/tb';
import { getSafeImageUrl, type ImageType } from '@/app/lib/urls';
import type { EncounterMode } from '@/app/features/appointments/types/workspace';

export type CompanionDetail = {
  label: string;
  value: string;
};

type CompanionContextCardProps = {
  name: string;
  photoUrl?: string;
  /** Companion species type used to resolve the species-specific fallback image. */
  speciesType?: string;
  details: CompanionDetail[];
  mode: EncounterMode;
  onViewDetails?: () => void;
};

const SPECIES_IMAGE_TYPES = new Set<ImageType>(['dog', 'cat', 'horse', 'other']);

const resolveImageType = (speciesType?: string): ImageType => {
  const candidate = speciesType?.toLowerCase() as ImageType | undefined;
  return candidate && SPECIES_IMAGE_TYPES.has(candidate) ? candidate : 'dog';
};

/** Fully-round 64×64 avatar — companion photo with a species-aware fallback. */
const RoundAvatar = ({
  name,
  photoUrl,
  speciesType,
}: {
  name: string;
  photoUrl?: string;
  speciesType?: string;
}) => (
  <Image
    src={getSafeImageUrl(photoUrl, resolveImageType(speciesType))}
    alt={name}
    width={64}
    height={64}
    className="size-16 shrink-0 rounded-full object-cover"
  />
);

const DetailRow = ({ label, value }: CompanionDetail) => (
  <div className="flex items-center gap-2">
    <span className="w-[88px] shrink-0 text-yc-12-r-neutral">{label}</span>
    <span className="flex-1 text-yc-12-b-neutral">{value || '-'}</span>
  </div>
);

/** Blue "Inpatient" / neutral "Outpatient" mode pill shown bottom-right. */
const ModePill = ({ mode }: { mode: EncounterMode }) =>
  mode === 'INPATIENT' ? (
    <span className="flex h-7 items-center gap-1.5 rounded-2xl bg-primary-500 px-3 text-yc-12-b-neutral text-neutral-0">
      <TbBed size={14} aria-hidden="true" />
      Inpatient
    </span>
  ) : (
    <span className="flex h-7 items-center gap-1.5 rounded-2xl bg-neutral-100 px-3 text-yc-12-b-neutral text-neutral-700">
      <LuFootprints size={14} aria-hidden="true" />
      Outpatient
    </span>
  );

/**
 * White companion card on the in-progress band. Round 64px avatar + a 3-column
 * grid of label/value rows. The right rail carries the "View Details" pill (→
 * companion overview) and the encounter mode pill.
 */
const CompanionContextCard = ({
  name,
  photoUrl,
  speciesType,
  details,
  mode,
  onViewDetails,
}: CompanionContextCardProps) => (
  <div className="flex min-h-22 items-center gap-5 rounded-2xl bg-neutral-0 px-5 py-4 shadow-[0_1px_10px_0_rgba(169,163,158,0.10)]">
    <RoundAvatar name={name} photoUrl={photoUrl} speciesType={speciesType} />
    <div className="grid flex-1 grid-cols-1 gap-x-10 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {details.map((detail) => (
        <DetailRow key={detail.label} label={detail.label} value={detail.value} />
      ))}
    </div>
    <div className="flex shrink-0 flex-col items-end justify-between gap-3 self-stretch">
      {onViewDetails ? (
        <button
          type="button"
          onClick={onViewDetails}
          className="flex h-8 w-34 items-center justify-end gap-1 rounded-2xl border border-neutral-700 bg-neutral-0 px-4 text-[14px] font-medium leading-[120%] text-neutral-700 shadow-[0_1px_10px_0_rgba(169,163,158,0.10)] transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          View Details
          <LuChevronRight size={16} aria-hidden="true" />
        </button>
      ) : (
        <span aria-hidden="true" className="h-8" />
      )}
      <ModePill mode={mode} />
    </div>
  </div>
);

export default CompanionContextCard;
