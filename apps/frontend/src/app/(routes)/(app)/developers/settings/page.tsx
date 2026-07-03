'use client';
import React, { useMemo } from 'react';

import '@/app/features/organizations/styles/Organizations.css';
import '@/app/features/settings/styles/Settings.css';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { useAuthStore } from '@/app/stores/authStore';

const DevSettingsPage = () => {
  const { attributes, user, role } = useAuthStore();

  const displayName = useMemo(() => {
    const name = `${attributes?.given_name || ''} ${attributes?.family_name || ''}`.trim();
    if (name) return name;
    if (attributes?.email) return attributes.email;
    return user?.getUsername() || 'Developer';
  }, [attributes?.email, attributes?.family_name, attributes?.given_name, user]);

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <h2>Developer Settings</h2>
        </div>
        <div className="OrgaizationsList">
          <div className="InviteTitle">Profile</div>
          <div className="SettingsCard">
            <p className="SettingsRow">
              <strong>Name:</strong> {displayName}
            </p>
            <p className="SettingsRow">
              <strong>Email:</strong> {attributes?.email || '-'}
            </p>
            <p className="SettingsRow">
              <strong>Role:</strong> {role || 'Developer'}
            </p>
          </div>
        </div>
      </div>
    </DevRouteGuard>
  );
};

export default DevSettingsPage;
