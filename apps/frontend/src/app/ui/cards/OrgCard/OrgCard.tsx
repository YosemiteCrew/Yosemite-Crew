'use client';
import React from 'react';
import clsx from 'clsx';
import {
  IoArrowForwardCircle,
  IoArrowForwardCircleOutline,
  IoShieldCheckmark,
} from 'react-icons/io5';

import Badge from '@/app/ui/Badge';
import { OrgWithMembership } from '@/app/features/organization/types/org';
import { useOrgStore } from '@/app/stores/orgStore';
import { toTitleCase } from '@/app/lib/validators';

import './OrgCard.css';

type OrgCardProps = {
  org: OrgWithMembership;
  handleOrgClick: (org: OrgWithMembership) => void;
};

// The design tints each org tile from a small palette rather than repeating one
// blue. Keyed off the name so a given org always keeps the same tint.
const AVATAR_TONES = ['blue', 'green', 'amber'] as const;

// `codePointAt` returns undefined for an empty name — fall back to the first tone.
const getAvatarTone = (name: string) =>
  AVATAR_TONES[(name.codePointAt(0) ?? 0) % AVATAR_TONES.length];

const OrgCard = ({ org, handleOrgClick }: OrgCardProps) => {
  const { name, type, isVerified } = org.org;
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const role = toTitleCase(org.membership?.roleDisplay);
  const initial = name.charAt(0).toUpperCase();
  const subline = [role, toTitleCase(type)].filter(Boolean).join(' · ');
  const orgId = org.org._id?.toString() || name;
  const isCurrent = !!primaryOrgId && primaryOrgId === orgId;
  // The design gives the selected card the blue tile; the rest rotate the palette.
  const avatarTone = isCurrent ? 'blue' : getAvatarTone(name);

  return (
    <button
      type="button"
      onClick={() => handleOrgClick(org)}
      className={clsx(
        'org-picker-card flex w-full items-center gap-3.5 bg-neutral-0 text-left',
        isCurrent && 'org-picker-card--current'
      )}
    >
      <span
        className={clsx(
          'org-picker-avatar flex shrink-0 items-center justify-center',
          `org-picker-avatar--${avatarTone}`
        )}
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="org-picker-name truncate">{name}</span>
          {isVerified ? (
            <Badge
              tone="success"
              className="org-picker-badge-verified shrink-0 px-2! py-0.5! text-[9px]!"
            >
              <IoShieldCheckmark aria-hidden />
              VERIFIED
            </Badge>
          ) : (
            <Badge tone="warning" className="shrink-0 px-2! py-0.5! text-[9px]!">
              PENDING
            </Badge>
          )}
        </span>
        <span className="mt-0.5 block truncate text-caption-1 text-text-tertiary">{subline}</span>
      </span>
      {isCurrent ? (
        <IoArrowForwardCircle
          className="org-picker-arrow org-picker-arrow--current shrink-0"
          size={26}
          aria-hidden
        />
      ) : (
        <IoArrowForwardCircleOutline className="org-picker-arrow shrink-0" size={26} aria-hidden />
      )}
    </button>
  );
};

export default OrgCard;
