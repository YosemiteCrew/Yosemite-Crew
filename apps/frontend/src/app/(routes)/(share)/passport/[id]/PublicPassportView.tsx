'use client';

import Image from 'next/image';
import {
  IoShieldCheckmark,
  IoShieldCheckmarkOutline,
  IoAirplaneOutline,
  IoMedkitOutline,
  IoCheckmarkCircle,
  IoAlertCircle,
} from 'react-icons/io5';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatDisplayDate } from '@/app/lib/date';
import { passportSexLabel } from '@yosemite-crew/types';
import type { ClinicalExamDTO, PetPassportDTO, VaccinationDTO } from '@yosemite-crew/types';

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Dog',
  cat: 'Cat',
  horse: 'Horse',
  other: 'Animal',
};

const speciesLabel = (species: string): string => SPECIES_LABEL[species] ?? 'Animal';

const dateLabel = (iso?: string): string | undefined => (iso ? formatDisplayDate(iso) : undefined);

// "Dog · Beagle · F, spayed · born 02 May 2022"
const descriptionLine = (identity: PetPassportDTO['identity']): string =>
  [
    speciesLabel(identity.species),
    identity.breed,
    passportSexLabel(identity.sex),
    dateLabel(identity.dateOfBirth) ? `born ${dateLabel(identity.dateOfBirth)}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

const microchipSub = (microchip: PetPassportDTO['microchip']): string | undefined => {
  if (!microchip) return undefined;
  const implanted = dateLabel(microchip.implantedAt);
  return [microchip.location, implanted ? `implanted ${implanted}` : undefined]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
};

// A rabies entry counts as valid only while its expiry parses and still lies in
// the future. A missing or unreadable expiry is reported as unknown rather than
// assumed valid - this page is read as proof of cover by travel and boarding staff.
type RabiesValidity = 'valid' | 'expired' | 'unknown';

const rabiesValidity = (validUntil?: string): RabiesValidity => {
  const expiry = validUntil ? new Date(validUntil) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return 'unknown';
  return expiry.getTime() > Date.now() ? 'valid' : 'expired';
};

const RABIES_STATUS: Record<
  RabiesValidity,
  { label: string; background: string; border: string; color: string }
> = {
  valid: {
    label: 'VALID',
    background: 'var(--status-completed-bg)',
    border: 'var(--status-completed-border)',
    color: 'var(--status-completed-text)',
  },
  expired: {
    label: 'EXPIRED',
    background: 'var(--status-danger-bg)',
    border: 'var(--status-danger-border)',
    color: 'var(--status-danger-text)',
  },
  unknown: {
    label: 'NO EXPIRY',
    background: 'var(--inset)',
    border: 'var(--divider)',
    color: 'var(--ink-soft)',
  },
};

// Travel fitness must reflect the most recent examination. The API returns exams
// newest-first, but the badge is too consequential to lean on ordering, so the
// newest is resolved by examination date; undated exams cannot be ranked and are
// left out rather than allowed to win.
const latestExamination = (exams: ClinicalExamDTO[]): ClinicalExamDTO | undefined => {
  let latest: { exam: ClinicalExamDTO; at: number } | undefined;
  for (const exam of exams) {
    const at = new Date(exam.examinedAt).getTime();
    if (!Number.isNaN(at) && (!latest || at > latest.at)) latest = { exam, at };
  }
  return latest?.exam;
};

const BrandMark = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 21s-7.5-4.6-10-9.2C.6 9 1.5 5.5 4.6 4.6 6.7 4 8.8 4.9 10 6.6c.4.5.7 1 .9 1.4.2-.4.5-.9.9-1.4C13.2 4.9 15.3 4 17.4 4.6c3.1.9 4 4.4 2.6 7.2C19.5 16.4 12 21 12 21z"
      fill="var(--blue-text)"
    />
  </svg>
);

const CHIP_TONES = {
  success: {
    background: 'var(--status-completed-bg)',
    color: 'var(--status-completed-text)',
    border: '1px solid var(--status-completed-border)',
  },
  danger: {
    background: 'var(--status-danger-bg)',
    color: 'var(--status-danger-text)',
    border: '1px solid var(--status-danger-border)',
  },
  neutral: {
    background: 'var(--inset)',
    color: 'var(--ink-soft)',
    border: '1px solid var(--divider)',
  },
} as const;

const StatusChip = ({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'success' | 'neutral' | 'danger';
}) => {
  const styles = CHIP_TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-[9px] py-1 text-[9.5px] font-bold"
      style={styles}
    >
      {icon}
      {label}
    </span>
  );
};

const cardStyle = {
  background: 'var(--screen)',
  border: '1px solid var(--hairline)',
  boxShadow: '0 1px 2px var(--sh03), 0 6px 16px var(--sh05)',
} as const;

const IdentityRow = ({ label, value, sub }: { label: string; value?: string; sub?: string }) => {
  if (!value) return null;
  return (
    <span className="flex justify-between gap-[10px] text-[12px]">
      <span style={{ color: 'var(--ink-faint)' }}>{label}</span>
      <span className="text-right font-semibold" style={{ color: 'var(--ink-body)' }}>
        {value}
        {sub && (
          <span className="block text-[10.5px] font-medium" style={{ color: 'var(--ink-faint)' }}>
            {sub}
          </span>
        )}
      </span>
    </span>
  );
};

// `validity` is supplied for the rabies entry only - its presence marks the row
// as the rabies one and drives the badge, so an expired shot can never be
// painted in the green "valid" treatment.
const VaccinationRow = ({
  vaccination,
  validity,
}: {
  vaccination: VaccinationDTO;
  validity?: RabiesValidity;
}) => {
  const isRabies = validity !== undefined;
  const status = validity ? RABIES_STATUS[validity] : undefined;
  const given = dateLabel(vaccination.dateAdministered);
  const meta = isRabies
    ? [
        given,
        vaccination.administeringVetName,
        vaccination.batchNumber && `batch ${vaccination.batchNumber}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : [given, vaccination.nextDueDate && `next due ${dateLabel(vaccination.nextDueDate)}`]
        .filter(Boolean)
        .join(' · ');
  const iconWrap = status
    ? {
        background: status.background,
        border: `1px solid ${status.border}`,
        color: status.color,
      }
    : {
        background: 'var(--blue-soft)',
        border: '1px solid var(--status-upcoming-border)',
        color: 'var(--blue-text)',
      };
  return (
    <div className="flex items-center gap-[10px]">
      <span
        className="flex size-8 flex-none items-center justify-center rounded-full text-[14px]"
        style={iconWrap}
      >
        {status ? <IoShieldCheckmarkOutline /> : <IoMedkitOutline />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold" style={{ color: 'var(--ink)' }}>
          {vaccination.vaccineName}
        </span>
        <span className="block text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
          {meta}
        </span>
      </span>
      {status && (
        <span
          className="flex-none whitespace-nowrap text-[9px] font-bold tracking-[0.08em]"
          style={{ color: status.color }}
        >
          {status.label}
        </span>
      )}
    </div>
  );
};

const PublicPassportView = ({ passport }: { passport: PetPassportDTO }) => {
  const { identity, microchip, rabies, vaccinations, issuance, clinicalExams } = passport;
  const rabiesStatus = rabies ? rabiesValidity(rabies.validUntil) : undefined;
  const newestExam = latestExamination(clinicalExams);
  const fitExam = newestExam?.fitForTravel ? newestExam : undefined;
  const practiceInitial = (issuance?.issuingPractice ?? 'Y').charAt(0).toUpperCase();

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BrandMark />
        <span className="text-[12px] font-bold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Yosemite Crew
        </span>
        <span className="flex-1" />
        <span
          className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-1 text-[9.5px] font-bold"
          style={{
            background: 'var(--status-completed-bg)',
            color: 'var(--status-completed-text)',
            border: '1px solid var(--status-completed-border)',
          }}
        >
          <span className="size-[5px] rounded-full bg-current" />
          <span>Verified record</span>
        </span>
      </div>

      {/* Companion card */}
      <div className="flex flex-col gap-[11px] rounded-[18px] p-4" style={cardStyle}>
        <div className="flex items-center gap-3">
          <span
            className="size-[54px] flex-none overflow-hidden rounded-full"
            style={{ background: 'var(--avatar-amber-bg)' }}
          >
            <Image
              alt={identity.name}
              src={getSafeImageUrl(identity.photoUrl, identity.species as ImageType)}
              height={54}
              width={54}
              className="size-full object-cover"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="yc-serif block text-[24px] tracking-[-0.015em]"
              style={{ color: 'var(--ink)' }}
            >
              {identity.name}
            </span>
            <span className="block text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
              {descriptionLine(identity)}
            </span>
          </span>
        </div>
        {(rabiesStatus === 'valid' || rabiesStatus === 'expired' || fitExam) && (
          <div className="flex flex-wrap gap-[6px]">
            {rabiesStatus === 'valid' && (
              <StatusChip
                tone="success"
                icon={<IoShieldCheckmark className="text-[10px]" />}
                label={`Rabies valid to ${dateLabel(rabies?.validUntil)}`}
              />
            )}
            {rabiesStatus === 'expired' && (
              <StatusChip
                tone="danger"
                icon={<IoAlertCircle className="text-[10px]" />}
                label={`Rabies expired ${dateLabel(rabies?.validUntil)}`}
              />
            )}
            {fitExam && (
              <StatusChip
                tone="neutral"
                icon={<IoAirplaneOutline className="text-[10px]" />}
                label={`Fit to travel · ${dateLabel(fitExam.examinedAt)}`}
              />
            )}
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="flex flex-col gap-2 rounded-[18px] p-4" style={cardStyle}>
        <span
          className="text-[9.5px] font-bold uppercase tracking-[0.12em]"
          style={{ color: 'var(--ink-faint)' }}
        >
          Identity
        </span>
        <IdentityRow label="Passport number" value={passport.passportNumber} />
        <IdentityRow label="Microchip" value={microchip?.number} sub={microchipSub(microchip)} />
        <IdentityRow label="Colour" value={identity.colour} />
        <IdentityRow label="Distinguishing marks" value={identity.distinguishingMarks} />
      </div>

      {/* Vaccinations */}
      {(rabies || vaccinations.length > 0) && (
        <div className="flex flex-col gap-[11px] rounded-[18px] p-4" style={cardStyle}>
          <span
            className="text-[9.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--ink-faint)' }}
          >
            Vaccinations
          </span>
          {rabies && <VaccinationRow vaccination={rabies} validity={rabiesStatus} />}
          {vaccinations.flatMap((vaccination) =>
            vaccination.id === rabies?.id
              ? []
              : [<VaccinationRow key={vaccination.id} vaccination={vaccination} />]
          )}
        </div>
      )}

      {/* Issuing practice */}
      {issuance && (
        <div
          className="flex items-center gap-[10px] rounded-[18px] p-[13px_16px]"
          style={cardStyle}
        >
          <span
            className="flex size-[34px] flex-none items-center justify-center rounded-[11px] text-[13px] font-bold"
            style={{ background: 'var(--blue-soft)', color: 'var(--blue-text)' }}
          >
            {practiceInitial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-bold" style={{ color: 'var(--ink)' }}>
              {issuance.issuingPractice ?? 'Yosemite Crew'}
            </span>
            <span className="block text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
              {[
                issuance.issuingVetName ? `Issued by ${issuance.issuingVetName}` : undefined,
                issuance.issuingCountry,
                dateLabel(issuance.issueDate),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <IoCheckmarkCircle className="text-[16px]" style={{ color: 'var(--success)' }} />
        </div>
      )}

      {/* Disclaimer */}
      <p
        className="mx-1 mt-[2px] text-[10px] leading-[1.5]"
        style={{ color: 'var(--ink-faint)', textWrap: 'pretty' }}
      >
        Digital record issued by the pet&apos;s veterinary practice. Not a legal substitute for an
        official government pet passport or health certificate for travel. Link revoked by the
        practice? This page stops resolving.
      </p>

      {/* Footer */}
      <div className="flex items-center justify-center gap-[6px] py-2">
        <BrandMark size={13} />
        <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-faint)' }}>
          Runs on Yosemite Crew, open source
        </span>
      </div>
    </div>
  );
};

export default PublicPassportView;
