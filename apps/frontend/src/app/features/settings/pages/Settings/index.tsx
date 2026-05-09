'use client';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import React from 'react';
import dynamic from 'next/dynamic';

const SettingsSectionSkeleton = () => (
  <div className="min-h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const OrgSection = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/OrgSection'),
  {
    loading: () => <SettingsSectionSkeleton />,
  }
);
const TimezonePreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/TimezonePreference'),
  { loading: () => <SettingsSectionSkeleton /> }
);
const DefaultOpenScreenPreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/DefaultOpenScreenPreference'),
  { loading: () => <SettingsSectionSkeleton /> }
);
const CompanionTerminologyPreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/CompanionTerminologyPreference'),
  { loading: () => <SettingsSectionSkeleton /> }
);
const DeleteProfile = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/DeleteProfile'),
  {
    loading: () => <SettingsSectionSkeleton />,
  }
);

const Settings = () => {
  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <OrgSection />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DefaultOpenScreenPreference />
        <TimezonePreference />
      </div>
      <CompanionTerminologyPreference />
      <DeleteProfile />
    </div>
  );
};

const ProtectedSettings = () => {
  return (
    <ProtectedRoute skeleton={<PageSkeleton variant="settings" />}>
      <Settings />
    </ProtectedRoute>
  );
};

export default ProtectedSettings;
