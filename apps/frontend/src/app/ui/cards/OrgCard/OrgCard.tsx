import React from 'react';
import { IoArrowForward, IoShieldCheckmark } from 'react-icons/io5';

import Badge from '@/app/ui/Badge';
import { OrgWithMembership } from '@/app/features/organization/types/org';
import { toTitleCase } from '@/app/lib/validators';

type OrgCardProps = {
  org: OrgWithMembership;
  handleOrgClick: (org: OrgWithMembership) => void;
};

const OrgCard = ({ org, handleOrgClick }: OrgCardProps) => {
  const { name, type, isVerified } = org.org;
  const role = toTitleCase(org.membership?.roleDisplay);
  const initial = name.charAt(0).toUpperCase();
  const subline = [role, toTitleCase(type)].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={() => handleOrgClick(org)}
      className="flex w-full items-center gap-3.5 rounded-[18px] border border-card-border bg-neutral-0 p-4 text-left shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] transition-colors hover:border-primary-600"
    >
      <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-primary-100 text-body-3-emphasis text-primary-700">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body-3-emphasis text-text-primary">{name}</span>
          {isVerified ? (
            <Badge tone="success" className="shrink-0 px-2! py-0.5! text-[9px]!">
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
      <IoArrowForward className="shrink-0 text-text-brand" size={22} aria-hidden />
    </button>
  );
};

export default OrgCard;
