'use client';

import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatDisplayDate } from '@/app/lib/date';
import { passportSexLabel } from '@yosemite-crew/types';
import type { PetPassportDTO } from '@yosemite-crew/types';

// Warm-bone wallet-pass preview (matches the PR #1675 wallet-pass service:
// background #EFE8DC, foreground #1D1C1B, label #6B6763). Renders the same
// field lines the Apple back fields / Google textModulesData carry.

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Dog',
  cat: 'Cat',
  horse: 'Horse',
  other: 'Animal',
};

const dateLabel = (iso?: string): string | undefined => (iso ? formatDisplayDate(iso) : undefined);

const joinParts = (parts: Array<string | undefined | false>): string | undefined => {
  const line = parts.filter((part): part is string => Boolean(part)).join(' · ');
  return line || undefined;
};

const microchipLine = (passport: PetPassportDTO): string | undefined => {
  const chip = passport.microchip;
  if (!chip?.number) return undefined;
  return joinParts([
    chip.number,
    chip.location,
    dateLabel(chip.implantedAt) && `implanted ${dateLabel(chip.implantedAt)}`,
  ]);
};

const rabiesLine = (passport: PetPassportDTO): string | undefined => {
  const rabies = passport.rabies;
  if (!rabies) return undefined;
  return joinParts([
    rabies.vaccineName,
    dateLabel(rabies.dateAdministered) && `given ${dateLabel(rabies.dateAdministered)}`,
    dateLabel(rabies.validUntil) && `valid to ${dateLabel(rabies.validUntil)}`,
  ]);
};

const nextDueLine = (passport: PetPassportDTO): string | undefined => {
  const now = Date.now();
  // Single pass: only the earliest future due date is ever used, so tracking a
  // running minimum avoids building and sorting an intermediate array.
  let earliest: { value: string; time: number } | undefined;
  for (const { nextDueDate } of passport.vaccinations) {
    if (!nextDueDate) continue;
    const time = new Date(nextDueDate).getTime();
    if (Number.isNaN(time) || time < now) continue;
    if (!earliest || time < earliest.time) earliest = { value: nextDueDate, time };
  }
  const soonest = earliest?.value;
  if (!soonest) return undefined;
  const vaccine = passport.vaccinations.find((v) => v.nextDueDate === soonest)?.vaccineName;
  return joinParts([dateLabel(soonest), vaccine]);
};

const issuedByLine = (passport: PetPassportDTO): string | undefined => {
  const issuance = passport.issuance;
  if (!issuance) return undefined;
  return joinParts([
    issuance.issuingVetName,
    issuance.issuingPractice,
    issuance.issuingCountry,
    dateLabel(issuance.issueDate),
  ]);
};

const NOTICE =
  "Digital record issued by the pet's veterinary practice. Not a legal substitute for an official government pet passport or health certificate for travel.";

const passTokens = {
  '--pbg': '#efe8dc',
  '--pfg': '#1d1c1b',
  '--pml': '#6b6763',
  '--phl': 'rgba(29,28,27,0.12)',
} as React.CSSProperties;

const DetailField = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div
      className="flex flex-col gap-[2px] border-t py-2"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: 'var(--ink-faint)' }}
      >
        {label}
      </span>
      <span className="text-[12px]" style={{ color: 'var(--ink-body)' }}>
        {value}
      </span>
    </div>
  );
};

const GoogleField = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-[1px]">
      <span className="text-[12px] font-bold" style={{ color: 'var(--ink)' }}>
        {label}
      </span>
      <span className="text-[11.5px]" style={{ color: 'var(--ink-muted)' }}>
        {value}
      </span>
    </div>
  );
};

const Qr = ({ value, size }: { value: string; size: number }) => (
  <div
    className="flex flex-col items-center gap-[3px] rounded-[10px] px-[10px] pb-[5px] pt-2"
    style={{ background: '#f7f3ec' }}
  >
    <QRCodeSVG value={value} size={size} fgColor="#1d1c1b" bgColor="#f7f3ec" />
    <span className="text-[9px] font-semibold tracking-[0.02em]" style={{ color: '#55524e' }}>
      {value}
    </span>
  </div>
);

const BrandMark = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 21s-7.5-4.6-10-9.2C.6 9 1.5 5.5 4.6 4.6 6.7 4 8.8 4.9 10 6.6c.4.5.7 1 .9 1.4.2-.4.5-.9.9-1.4C13.2 4.9 15.3 4 17.4 4.6c3.1.9 4 4.4 2.6 7.2C19.5 16.4 12 21 12 21z"
      fill="#257bed"
    />
  </svg>
);

type WalletPassPreviewProps = { passport: PetPassportDTO; variant: 'apple' | 'google' };

const AppleField = ({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: string;
  align?: 'left' | 'right';
}) => (
  <span className={`flex flex-col gap-[2px] ${align === 'right' ? 'text-right' : ''}`}>
    <span
      className="text-[9.5px] font-bold uppercase tracking-[0.1em]"
      style={{ color: 'var(--pml)' }}
    >
      {label}
    </span>
    <span className="text-[14.5px] font-semibold" style={{ color: 'var(--pfg)' }}>
      {value}
    </span>
  </span>
);

const WalletPassPreview = ({ passport, variant }: WalletPassPreviewProps) => {
  const { identity } = passport;
  const species = SPECIES_LABEL[identity.species] ?? 'Animal';
  const passNo = passport.passportNumber ?? identity.id;
  const photo = getSafeImageUrl(identity.photoUrl, identity.species as ImageType);

  if (variant === 'google') {
    return (
      <div className="flex flex-col gap-[14px]">
        <div
          className="flex flex-col rounded-[18px]"
          style={{
            ...passTokens,
            background: 'var(--pbg)',
            border: '1px solid var(--phl)',
            boxShadow: '0 3px 8px var(--sh08), 0 18px 44px var(--sh16)',
          }}
        >
          <div
            className="flex items-center gap-[9px] border-b px-[18px] py-[13px]"
            style={{ borderColor: 'var(--phl)' }}
          >
            <BrandMark size={22} />
            <span className="text-[12.5px] font-bold" style={{ color: 'var(--pfg)' }}>
              Yosemite Crew
            </span>
          </div>
          <div className="flex flex-col gap-[14px] px-[18px] pb-[18px] pt-[14px]">
            <div className="flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--pml)' }}>
                  Digital Pet Passport
                </span>
                <span
                  className="text-[29px] font-medium leading-[1.05] tracking-[-0.02em]"
                  style={{ color: 'var(--pfg)' }}
                >
                  {identity.name}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--pml)' }}>
                  {[species, identity.breed, passportSexLabel(identity.sex)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Image
                alt={identity.name}
                src={photo}
                width={56}
                height={56}
                className="size-14 flex-none rounded-full object-cover"
              />
            </div>
            <div className="self-center">
              <Qr value={passNo} size={108} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-[11px]">
          <span
            className="text-[13.5px] font-bold tracking-[-0.01em]"
            style={{ color: 'var(--ink)' }}
          >
            Details
          </span>
          <div className="flex flex-col gap-[10px]">
            <GoogleField label="Passport No." value={passNo} />
            <GoogleField label="Microchip" value={microchipLine(passport)} />
            <GoogleField label="Date of birth" value={dateLabel(identity.dateOfBirth)} />
            <GoogleField label="Colour" value={identity.colour} />
            <GoogleField label="Rabies vaccination" value={rabiesLine(passport)} />
            <GoogleField label="Next vaccination due" value={nextDueLine(passport)} />
            <GoogleField label="Issued by" value={issuedByLine(passport)} />
            <GoogleField label="Notice" value={NOTICE} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-col gap-[15px] rounded-[14px] px-[18px] pb-4 pt-[15px]"
        style={{
          ...passTokens,
          background: 'var(--pbg)',
          border: '1px solid var(--phl)',
          boxShadow: '0 3px 8px var(--sh08), 0 18px 44px var(--sh16)',
        }}
      >
        <div className="flex items-center gap-[9px]">
          <BrandMark size={26} />
          <span
            className="text-[14px] font-bold tracking-[-0.01em]"
            style={{ color: 'var(--pfg)' }}
          >
            Pet Passport
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-[2px]">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ color: 'var(--pml)' }}
            >
              Name
            </span>
            <span
              className="text-[31px] font-medium leading-[1.05] tracking-[-0.02em]"
              style={{ color: 'var(--pfg)' }}
            >
              {identity.name}
            </span>
          </span>
          <Image
            alt={identity.name}
            src={photo}
            width={60}
            height={60}
            className="size-[60px] flex-none rounded-[12px] object-cover"
          />
        </div>
        <div className="flex justify-between gap-3">
          <AppleField label="Passport No." value={passNo} />
          <AppleField label="Species" value={species} align="right" />
        </div>
        <div className="flex justify-between gap-3">
          <AppleField label="Breed" value={identity.breed} />
          <AppleField
            label="Sex"
            value={passportSexLabel(identity.sex) ?? 'Unknown'}
            align="right"
          />
        </div>
        <div className="mt-[2px] self-center">
          <Qr value={passNo} size={104} />
        </div>
      </div>
      {nextDueLine(passport) && (
        <div
          className="flex items-center justify-center gap-[6px] text-[10.5px]"
          style={{ color: 'var(--ink-faint)' }}
        >
          Surfaces on the Lock Screen around {nextDueLine(passport)}
        </div>
      )}
      <div
        className="flex flex-col rounded-[16px] px-[15px] py-[13px]"
        style={{ background: 'var(--screen)', border: '1px solid var(--hairline)' }}
      >
        <span className="pb-[9px] text-[12.5px] font-bold" style={{ color: 'var(--ink)' }}>
          Pass details
        </span>
        <DetailField label="Microchip" value={microchipLine(passport)} />
        <DetailField label="Rabies vaccination" value={rabiesLine(passport)} />
        <DetailField label="Next vaccination due" value={nextDueLine(passport)} />
        <DetailField label="Issued by" value={issuedByLine(passport)} />
        <DetailField label="Notice" value={NOTICE} />
      </div>
    </div>
  );
};

export default WalletPassPreview;
