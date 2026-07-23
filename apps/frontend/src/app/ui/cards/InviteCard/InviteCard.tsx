import React from 'react';

import Badge from '@/app/ui/Badge';
import { Invite } from '@/app/features/organization/types/team';
import { toTitle, toTitleCase } from '@/app/lib/validators';

import './InviteCard.css';

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
    <div className="invite-picker-card flex w-full items-center gap-3.5 bg-neutral-0">
      <span className="invite-picker-avatar flex shrink-0 items-center justify-center">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="invite-picker-name truncate">{invite.organisationName}</span>
          <Badge tone="neutral" className="invite-picker-badge shrink-0">
            INVITED
          </Badge>
        </span>
        <span className="mt-0.5 block truncate text-caption-1 text-text-tertiary">{subline}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleAccept(invite)}
          disabled={disabled}
          className="invite-picker-action invite-picker-action--accept"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => handleReject(invite)}
          disabled={disabled}
          className="invite-picker-action invite-picker-action--decline"
        >
          Decline
        </button>
      </span>
    </div>
  );
};

export default InviteCard;
