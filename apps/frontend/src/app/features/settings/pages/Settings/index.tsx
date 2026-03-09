'use client';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import React from 'react';
import Personal from '@/app/features/settings/pages/Settings/Sections/Personal';
import DeleteProfile from '@/app/features/settings/pages/Settings/Sections/DeleteProfile';
import OrgSection from '@/app/features/settings/pages/Settings/Sections/OrgSection';
import TimezonePreference from '@/app/features/settings/pages/Settings/Sections/TimezonePreference';
import DefaultOpenScreenPreference from '@/app/features/settings/pages/Settings/Sections/DefaultOpenScreenPreference';
import CompanionTerminologyPreference from '@/app/features/settings/pages/Settings/Sections/CompanionTerminologyPreference';

const Settings = () => {
  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <Personal />
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
    <ProtectedRoute>
      <Settings />
    </ProtectedRoute>
  );
};

export default ProtectedSettings;
