'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { useOrgStore } from '@/app/stores/orgStore';

const OrganizationSectionSkeleton = () => (
  <div className="min-h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const Profile = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/Profile'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const Specialities = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/Specialities/Specialities'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const Rooms = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/Rooms/Rooms'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const Team = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/Team/Team'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const Payment = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/Payment'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const Documents = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/Documents/Documents'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const DocumentESigning = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/DocumentESigning'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const LinkedMedicalDevices = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/LinkedMedicalDevices'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const DeleteOrg = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/DeleteOrg'),
  { loading: () => <OrganizationSectionSkeleton /> }
);

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

export const Organization = () => {
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
          <Team isVerified={primaryorg.isVerified} />
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
    <ProtectedRoute skeleton={<PageSkeleton variant="settings" />}>
      <OrgGuard skeleton={<PageSkeleton variant="settings" />}>
        <Organization />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedOrganizations;
