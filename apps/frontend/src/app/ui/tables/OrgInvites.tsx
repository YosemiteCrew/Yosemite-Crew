'use client';
import React, { useState } from 'react';

import InviteCard from '@/app/ui/cards/InviteCard/InviteCard';
import { Invite } from '@/app/features/organization/types/team';
import { acceptInvite, rejectInvite } from '@/app/features/organization/services/teamService';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';

type OrgInvitesProps = {
  invites: Invite[];
  setInvites: React.Dispatch<React.SetStateAction<Invite[]>>;
  onAccepting: (accepting: boolean) => void;
  onNavigate: (path: string) => void;
};

const OrgInvites = ({ invites, setInvites, onAccepting, onNavigate }: OrgInvitesProps) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (invite: Invite) => {
    setProcessingId(invite._id);
    onAccepting(true);
    try {
      await acceptInvite(invite);
      // Remove from invites list immediately after accept succeeds
      setInvites((prev) => prev.filter((i) => i._id !== invite._id));
      // Resolve correct next screen — team-onboarding if profile incomplete, else default landing
      const nextRoute = await resolveOrgScopedRedirect({
        orgId: invite.organisationId,
      });
      onNavigate(nextRoute);
    } catch {
      onAccepting(false);
      setProcessingId(null);
    }
  };

  const handleReject = async (invite: Invite) => {
    setProcessingId(invite._id);
    try {
      await rejectInvite(invite);
      setInvites((prev) => prev.filter((i) => i._id !== invite._id));
    } catch {
      // silent — invite stays in list if reject fails
    } finally {
      setProcessingId(null);
    }
  };

  if (invites.length === 0) {
    return null;
  }

  return (
    <>
      {invites.map((invite, index) => (
        <InviteCard
          key={invite._id + index}
          invite={invite}
          handleAccept={handleAccept}
          handleReject={handleReject}
          disabled={processingId !== null}
        />
      ))}
    </>
  );
};

export default OrgInvites;
