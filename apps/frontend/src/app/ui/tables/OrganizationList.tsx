'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

import OrgCard from '@/app/ui/cards/OrgCard/OrgCard';
import { useOrgStore } from '@/app/stores/orgStore';
import { OrgWithMembership } from '@/app/features/organization/types/org';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';

type OrganizationListProps = {
  orgs: OrgWithMembership[];
};

const OrganizationList = ({ orgs }: OrganizationListProps) => {
  const router = useRouter();
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);

  const handleOrgClick = async (org: OrgWithMembership) => {
    const id = org.org._id?.toString() || org.org.name;
    setPrimaryOrg(id);
    const { show, hide } = useFullscreenLoaderStore.getState();
    show('org-switch');
    startRouteLoader();
    try {
      const role = org.membership?.roleDisplay ?? org.membership?.roleCode;
      const nextRoute = await resolveOrgScopedRedirect({ orgId: id, fallbackRole: role });
      router.push(nextRoute);
    } catch {
      hide('org-switch');
      stopRouteLoader();
    }
  };

  if (orgs.length === 0) {
    return null;
  }

  return (
    <>
      {orgs.map((org, index) => (
        <OrgCard key={org.org.name + index} org={org} handleOrgClick={handleOrgClick} />
      ))}
    </>
  );
};

export default OrganizationList;
