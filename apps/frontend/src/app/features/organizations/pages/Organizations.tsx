'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgInvites from '@/app/ui/tables/OrgInvites';
import OrganizationList from '@/app/ui/tables/OrganizationList';
import CreateOrgCard from '@/app/ui/cards/CreateOrgCard/CreateOrgCard';
import OrgGreeting from '@/app/features/organizations/components/OrgGreeting/OrgGreeting';
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
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2 pl-3! pr-3! pt-6! pb-6! md:pl-5! md:pr-5! md:pt-8! md:pb-8!">
      <OrgGreeting orgCount={orgs.length} />

      <div className="flex flex-col gap-3">
        <OrganizationList orgs={orgs} />

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

        <CreateOrgCard />
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
