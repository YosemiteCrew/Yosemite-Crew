'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';

const OrganizationSectionSkeleton = () => (
  <div className="min-h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);
const ORG_PAGE_SKELETON = <PageSkeleton variant="settings" />;

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
const OnlineBooking = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/OnlineBooking'),
  { loading: () => <OrganizationSectionSkeleton /> }
);

const BookingRequests = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/BookingRequests'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const DeleteOrg = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/DeleteOrg'),
  { loading: () => <OrganizationSectionSkeleton /> }
);
const PhoneOrganization = dynamic(
  () => import('@/app/features/organization/pages/Organization/Sections/PhoneOrganization'),
  { loading: () => <OrganizationSectionSkeleton /> }
);

const OrgPageSkeleton = () => (
  <div className="yc-page-content">
    {[1, 2, 3].map((i) => (
      <div key={i} className="border border-card-border rounded-2xl animate-pulse">
        <div className="px-6 py-4 border-b border-card-border">
          <div className="h-4 w-32 bg-neutral-100 rounded" />
        </div>
        <div className="p-6 flex flex-col gap-3">
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
  const isPhone = useIsPhone();

  if (orgStatus === 'loading' || orgStatus === 'idle') return <OrgPageSkeleton />;
  if (!primaryorg) return <OrgPageSkeleton />;

  if (isPhone) {
    return <PhoneOrganization primaryOrg={primaryorg} />;
  }

  return (
    <div className="yc-page-content flex flex-col gap-[14px]">
      <Profile primaryOrg={primaryorg} />
      {primaryorg.isVerified ? (
        <div className="grid gap-[14px] xl:grid-cols-[1.5fr_1fr] xl:items-stretch">
          <Team isVerified={primaryorg.isVerified} />
          <div className="flex min-h-0 flex-col gap-[14px]">
            <Rooms />
            <Payment />
            <DeleteOrg />
          </div>
        </div>
      ) : (
        <DeleteOrg />
      )}
      <Specialities />
      {primaryorg.isVerified && (
        <>
          <LinkedMedicalDevices />
          <Documents />
          <DocumentESigning />
          <OnlineBooking />
          <BookingRequests />
        </>
      )}
    </div>
  );
};

const ProtectedOrganizations = () => {
  return (
    <ProtectedRoute skeleton={ORG_PAGE_SKELETON}>
      <OrgGuard skeleton={ORG_PAGE_SKELETON}>
        <Organization />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedOrganizations;
