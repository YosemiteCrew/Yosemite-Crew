'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { Primary } from '@/app/ui/primitives/Buttons';
import OrgInvites from '@/app/ui/tables/OrgInvites';
import OrganizationList from '@/app/ui/tables/OrganizationList';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrgWithMemberships } from '@/app/hooks/useOrgSelectors';
import { loadInvites } from '@/app/features/organization/services/teamService';
import { Invite } from '@/app/features/organization/types/team';

const Organizations = () => {
  const router = useRouter();
  const orgs = useOrgWithMemberships();
  const orgStatus = useOrgStore((s) => s.status);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  // Separate flag for the accept flow — covers the async work + navigation delay
  const [accepting, setAccepting] = useState(false);

  const isOrgLoading = orgStatus === 'loading';

  useEffect(() => {
    let cancelled = false;
    setInvitesLoading(true);
    loadInvites()
      .then((data) => {
        if (!cancelled) setInvites(data);
      })
      .catch(() => {
        if (!cancelled) setInvites([]);
      })
      .finally(() => {
        if (!cancelled) setInvitesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  // Show full-screen loader while orgs are loading OR while an invite is being
  // accepted (prevents the flicker where orgStatus briefly becomes 'loading').
  if (isOrgLoading || accepting) {
    return (
      <YosemiteLoader variant="fullscreen-translucent" size={120} testId="organizations-loader" />
    );
  }

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="flex items-center justify-between w-full">
        <div className="text-text-primary text-heading-2">Overview</div>
        <Primary href="/create-org" text="Create organisation" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-body-2 text-text-primary">
          Existing organisations <span className="text-text-tertiary">{`(${orgs.length})`}</span>
        </div>
        <OrganizationList orgs={orgs} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-body-2 text-text-primary">
          Invites{' '}
          <span className="text-text-tertiary">{`(${invitesLoading ? '…' : invites.length})`}</span>
        </div>
        {invitesLoading ? (
          <div className="flex items-center justify-center py-6">
            <YosemiteLoader variant="inline" size={32} testId="invites-loader" />
          </div>
        ) : (
          <OrgInvites
            invites={invites}
            setInvites={setInvites}
            onAccepting={setAccepting}
            onNavigate={handleNavigate}
          />
        )}
      </div>
    </div>
  );
};

const ProtectedOrganizations = () => (
  <ProtectedRoute>
    <Organizations />
  </ProtectedRoute>
);

export default ProtectedOrganizations;
