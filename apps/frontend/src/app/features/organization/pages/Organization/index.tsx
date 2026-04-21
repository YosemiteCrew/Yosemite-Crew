'use client';
import React from 'react';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import {
  Profile,
  Specialities,
  Rooms,
  Team,
  Payment,
  Documents,
  DocumentESigning,
  LinkedMedicalDevices,
  DeleteOrg,
} from '@/app/features/organization/pages/Organization/Sections';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useOrgStore } from '@/app/stores/orgStore';

const OrgPageSkeleton = () => (
  <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5!">
    {[1, 2, 3].map((i) => (
      <div key={i} className="border border-card-border rounded-2xl animate-pulse">
        <div className="px-6 py-4 border-b border-card-border">
          <div className="h-4 w-32 bg-neutral-100 rounded" />
        </div>
        <div className="px-6 py-6 flex flex-col gap-3">
          <div className="h-4 w-full bg-neutral-100 rounded" />
          <div className="h-4 w-3/4 bg-neutral-100 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const Organization = () => {
  const primaryorg = usePrimaryOrg();
  const orgStatus = useOrgStore((s) => s.status);

  if (orgStatus === 'loading' || orgStatus === 'idle') return <OrgPageSkeleton />;
  if (!primaryorg) return <OrgPageSkeleton />;

  return (
    <div className="flex flex-col gap-6 sm:gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <Profile primaryOrg={primaryorg} />
      <Specialities />
      {primaryorg.isVerified && (
        <>
          <Team />
          <Rooms />
          <Payment />
          <LinkedMedicalDevices />
          <Documents />
          <DocumentESigning />
        </>
      )}
      <DeleteOrg />
    </div>
  );
};

const ProtectedOrganizations = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Organization />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedOrganizations;
