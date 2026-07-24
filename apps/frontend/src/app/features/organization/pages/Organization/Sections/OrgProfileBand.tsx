import React from 'react';
import Image from 'next/image';
import { IoCreateOutline, IoShieldCheckmark } from 'react-icons/io5';
import { Organisation } from '@yosemite-crew/types';
import { getSafeImageUrl } from '@/app/lib/urls';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  COMPLETED_PILL_TOKENS,
  REQUESTED_PILL_TOKENS,
  UPCOMING_PILL_TOKENS,
  initialsOf,
  orgTypePillLabel,
} from '@/app/features/organization/pages/Organization/Sections/orgDisplay';

type OrgProfileBandProps = {
  org: Organisation;
  canEdit: boolean;
  onEdit: () => void;
};

const buildAddress = (org: Organisation): string => {
  const addr = org.address;
  const line2 = [addr?.postalCode, addr?.city].filter(Boolean).join(' ');
  return [addr?.addressLine, line2].filter(Boolean).join(', ');
};

const buildPrimaryMeta = (org: Organisation): string =>
  [buildAddress(org), org.phoneNo, org.website, org.taxId ? `Tax ID ${org.taxId}` : '']
    .filter(Boolean)
    .join(' · ');

const buildSecondaryMeta = (org: Organisation): string => {
  const parts: string[] = [];
  if (typeof org.appointmentCheckInBufferMinutes === 'number') {
    parts.push(`Check-in buffer: ${org.appointmentCheckInBufferMinutes} min`);
  }
  if (typeof org.appointmentCheckInRadiusMeters === 'number') {
    parts.push(`Check-in radius: ${org.appointmentCheckInRadiusMeters} m`);
  }
  if (org.DUNSNumber) {
    parts.push(`DUNS ${org.DUNSNumber}`);
  }
  return parts.join(' · ');
};

const OrgAvatar = ({ org }: { org: Organisation }) => {
  if (org.imageURL) {
    return (
      <Image
        src={getSafeImageUrl(org.imageURL, 'business')}
        alt=""
        height={62}
        width={62}
        unoptimized
        className="size-[62px] flex-none rounded-[18px] object-cover"
      />
    );
  }
  return (
    <span className="flex size-[62px] flex-none items-center justify-center rounded-[18px] bg-[var(--blue-soft)] text-[24px] font-extrabold text-[var(--blue-text)]">
      {initialsOf(org.name).charAt(0)}
    </span>
  );
};

const OrgProfileBand = ({ org, canEdit, onEdit }: OrgProfileBandProps) => {
  const primaryMeta = buildPrimaryMeta(org);
  const secondaryMeta = buildSecondaryMeta(org);

  return (
    <div className="flex flex-col gap-[14px] rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-[22px]! py-5! shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] sm:flex-row sm:items-center sm:gap-[18px]">
      <OrgAvatar org={org} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-[10px]">
          <span className="font-newsreader text-[24px] tracking-[-0.015em] text-[var(--ink)]">
            {org.name || 'Organization'}
          </span>
          {org.isVerified ? (
            <StatusPill
              tokens={COMPLETED_PILL_TOKENS}
              label={
                <>
                  <IoShieldCheckmark size={10} aria-hidden="true" />
                  VERIFIED
                </>
              }
            />
          ) : (
            <StatusPill label="PENDING" tokens={REQUESTED_PILL_TOKENS} />
          )}
          <StatusPill label={orgTypePillLabel(org.type)} tokens={UPCOMING_PILL_TOKENS} />
        </span>
        {primaryMeta && <span className="text-[13px] text-[var(--ink-muted)]">{primaryMeta}</span>}
        {secondaryMeta && (
          <span className="text-[12.5px] text-[var(--ink-faint)]">{secondaryMeta}</span>
        )}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-[38px] flex-none items-center gap-[7px] rounded-full border border-[var(--divider)] px-4! text-[12.5px] font-semibold text-[var(--ink-body)] hover:border-[var(--blue)] hover:text-[var(--blue-text)] transition-colors cursor-pointer"
        >
          <IoCreateOutline size={14} aria-hidden="true" />
          Edit profile
        </button>
      )}
    </div>
  );
};

export default OrgProfileBand;
