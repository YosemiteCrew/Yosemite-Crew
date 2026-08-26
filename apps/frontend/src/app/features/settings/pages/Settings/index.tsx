'use client';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { IoInformationCircleOutline } from 'react-icons/io5';

import { PreferenceGroup } from '@/app/features/settings/pages/Settings/Sections/PreferenceGroup';
import '@/app/features/settings/styles/Settings.css';

const SETTINGS_PAGE_SKELETON = <PageSkeleton variant="settings" />;

const CardSkeleton = () => (
  <div className="min-h-40 rounded-[18px] bg-card-hover animate-pulse" aria-hidden="true" />
);
const RowSkeleton = () => (
  <div className="h-9 rounded-xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const Personal = dynamic(() => import('@/app/features/settings/pages/Settings/Sections/Personal'), {
  loading: () => <CardSkeleton />,
});
const ProfileEditModal = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/ProfileEditModal'),
  { loading: () => null }
);
const HoursEditModal = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/HoursEditModal'),
  { loading: () => null }
);
const YourOrganizations = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/YourOrganizations'),
  { loading: () => <CardSkeleton /> }
);
const TimezonePreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/TimezonePreference'),
  { loading: () => <RowSkeleton /> }
);
const DefaultOpenScreenPreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/DefaultOpenScreenPreference'),
  { loading: () => <RowSkeleton /> }
);
const CompanionTerminologyPreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/CompanionTerminologyPreference'),
  { loading: () => <RowSkeleton /> }
);
const AppointmentLockWindowPreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/AppointmentLockWindowPreference'),
  { loading: () => <RowSkeleton /> }
);
const CrossClinicMessagingPreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/CrossClinicMessagingPreference'),
  { loading: () => <RowSkeleton /> }
);
const AppearancePreference = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/AppearancePreference'),
  { loading: () => <RowSkeleton /> }
);
const DeleteProfile = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/DeleteProfile'),
  {
    loading: () => <CardSkeleton />,
  }
);
const FederationSection = dynamic(
  () => import('@/app/features/settings/pages/Settings/Sections/FederationSection'),
  { loading: () => <CardSkeleton /> }
);

/**
 * A scope band: the labelled region that separates personal settings from
 * clinic-wide ones. The heading is what tells a reader, before they touch
 * anything, whether a change is theirs alone or everyone's.
 */
const SettingsBand = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-3.5" aria-labelledby={`settings-band-${title}`}>
    <div className="flex flex-col gap-[2px]">
      <h2
        id={`settings-band-${title}`}
        className="m-0! text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]"
      >
        {title}
      </h2>
      <p className="m-0! text-[12px] text-[var(--ink-faint)]">{description}</p>
    </div>
    {children}
  </section>
);

const Settings = () => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);

  return (
    <div className="yc-page-content">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h1
            className="m-0! flex items-center gap-2 text-[22px] md:text-[26px] leading-[1.05] tracking-[-0.015em] text-[var(--ink)]"
            style={{ fontFamily: 'var(--font-newsreader)', fontWeight: 400 }}
          >
            Settings
            <IoInformationCircleOutline
              size={17}
              color="var(--ink-faint)"
              aria-hidden="true"
              className="flex-none"
            />
          </h1>
          <span className="yc-settings-subtitle">
            Your preferences, and the clinic settings you administer
          </span>
        </div>
        <span className="yc-settings-autosave">
          <span className="yc-settings-autosave-dot" aria-hidden="true" />
          {'Changes save automatically'}
        </span>
      </div>

      {/* The page is split by WHO a setting affects, not by topic. Grouping by
          topic previously put per-user controls under a card called "Workspace
          preferences" and clinic-wide controls beside a device theme toggle, so
          the labels pointed away from the truth. Scope is the axis that changes
          whether a click is safe, so it is the axis the page is built on. */}
      <SettingsBand
        title="Personal"
        description="Yours alone. Colleagues are unaffected by anything in this section."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 items-start">
          <Personal
            onEditProfile={() => setProfileOpen(true)}
            onEditHours={() => setHoursOpen(true)}
          />

          {/* Every control here writes the per-user profile (patchUserProfile) or
              device-local theme storage — none of it is workspace-wide, which is
              what the old "Workspace preferences" title wrongly implied. */}
          <PreferenceGroup title="Your preferences" scope="personal">
            <DefaultOpenScreenPreference />
            <TimezonePreference />
            <CompanionTerminologyPreference />
            <AppearancePreference />
          </PreferenceGroup>

          <YourOrganizations />
          <DeleteProfile />
        </div>
      </SettingsBand>

      <SettingsBand
        title="Organisation"
        description="Shared clinic settings. Changes here apply to every colleague."
      >
        <div className="flex flex-col gap-3.5">
          {/* Both write the organisation record via updateOrg. */}
          <PreferenceGroup title="Scheduling & messaging" scope="organisation">
            <AppointmentLockWindowPreference />
            <CrossClinicMessagingPreference />
          </PreferenceGroup>

          {/* Federation is institution-to-institution: clinical referrals, directory
              presence and trust between practices. It is deliberately separate from
              the cross-clinic messaging toggle above, which only governs colleague
              chat. A clinic can federate without opening its staff to chat, and the
              reverse, so the two switches are not merged. */}
          <FederationSection />
        </div>
      </SettingsBand>

      {/* Detailed editors are reached from the Personal card's "Edit profile" /
          "Edit hours" affordances as centered modals, so the page itself stays
          the compact control panel the design specifies. */}
      <ProfileEditModal showModal={profileOpen} setShowModal={setProfileOpen} />
      <HoursEditModal showModal={hoursOpen} setShowModal={setHoursOpen} />
    </div>
  );
};

const ProtectedSettings = () => {
  return (
    <ProtectedRoute skeleton={SETTINGS_PAGE_SKELETON}>
      <Settings />
    </ProtectedRoute>
  );
};

export default ProtectedSettings;
