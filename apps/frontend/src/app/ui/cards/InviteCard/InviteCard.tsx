import React from 'react';

import Badge from '@/app/ui/Badge';
import { Invite } from '@/app/features/organization/types/team';
import { toTitle, toTitleCase } from '@/app/lib/validators';

type InviteCardProps = {
  invite: Invite;
  handleAccept: (invite: Invite) => Promise<void>;
  handleReject: (invite: Invite) => void;
  disabled?: boolean;
};

const InviteCard = ({ invite, handleAccept, handleReject, disabled = false }: InviteCardProps) => {
  const role = toTitleCase(invite.role);
  const employment = toTitle(invite.employmentType);
  const initial = invite.organisationName.charAt(0).toUpperCase();
  const subline = [role, employment, 'accept to join'].filter(Boolean).join(' · ');

  return (
    <div className="flex w-full items-center gap-3.5 rounded-[18px] border border-card-border bg-neutral-0 p-4 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
      <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-warning-100 text-body-3-emphasis text-warning-700">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body-3-emphasis text-text-primary">
            {invite.organisationName}
          </span>
          <Badge tone="warning" className="shrink-0 px-2! py-0.5! text-[9px]!">
            INVITED
          </Badge>
        </span>
        <span className="mt-0.5 block truncate text-caption-1 text-text-tertiary">{subline}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => handleAccept(invite)}
          disabled={disabled}
          className="rounded-full bg-primary-600 px-3.5 py-1.5 text-caption-1 font-bold text-neutral-0 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => handleReject(invite)}
          disabled={disabled}
          className="rounded-full border border-card-border px-3.5 py-1.5 text-caption-1 font-bold text-text-secondary disabled:opacity-50"
        >
          Decline
        </button>
      </span>
    </div>
  );
};

export default InviteCard;
