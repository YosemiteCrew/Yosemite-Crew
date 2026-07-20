import React, { useMemo, useState, useRef } from 'react';
import { useNotify } from '@/app/hooks/useNotify';
import { setSavedDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';
import {
  DefaultAppointmentsView,
  setSavedDefaultAppointmentsView,
} from '@/app/lib/defaultAppointmentsView';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { useOrgStore } from '@/app/stores/orgStore';
import { patchUserProfile } from '@/app/features/organization/services/profileService';
import {
  appointmentViewToLocal,
  defaultOpenScreenToRoute,
  localToAppointmentView,
  normalizePmsPreferences,
  routeToDefaultOpenScreen,
} from '@/app/features/settings/utils/pmsPreferences';
import { PreferenceRow } from './PreferenceGroup';
import PillSelect from './PillSelect';

const APPOINTMENT_VIEW_OPTIONS = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'board', label: 'Status Board' },
  { value: 'list', label: 'Table' },
];

const DefaultOpenScreenPreference = () => {
  const { notify } = useNotify();
  const profile = usePrimaryOrgProfile();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const pmsPreferences = normalizePmsPreferences(
    profile?.personalDetails?.pmsPreferences,
    primaryOrgType
  );
  const defaultRouteFromProfile = defaultOpenScreenToRoute(pmsPreferences.defaultOpenScreen);
  const defaultViewFromProfile = appointmentViewToLocal(pmsPreferences.appointmentView);
  const savedRoute = defaultRouteFromProfile;
  const savedView = defaultViewFromProfile;

  const options = useMemo(
    () => [
      { value: '/dashboard', label: 'Dashboard' },
      { value: '/appointments', label: 'Appointments' },
    ],
    []
  );

  const [selection, setSelection] = useState<string>(savedRoute);
  const [defaultView, setDefaultView] = useState<DefaultAppointmentsView>(savedView);
  const shouldShowDefaultView = selection === '/appointments';

  const prevSavedRouteRef = useRef(savedRoute);
  const prevSavedViewRef = useRef(savedView);
  if (prevSavedRouteRef.current !== savedRoute || prevSavedViewRef.current !== savedView) {
    prevSavedRouteRef.current = savedRoute;
    prevSavedViewRef.current = savedView;
    setSelection(savedRoute);
    setDefaultView(savedView);
  }

  // Auto-save model from the design: dropdowns commit on change and the page header
  // carries the single "Changes save automatically" indicator, so there is no
  // per-preference Save button. Only failures surface a notification.
  const persist = async (nextRoute: string, nextView: DefaultAppointmentsView) => {
    if (!primaryOrgId) {
      notify('error', {
        title: 'Organization not selected',
        text: 'Please select an organization and try again.',
      });
      return;
    }
    const route = nextRoute === '/dashboard' ? '/dashboard' : '/appointments';
    setSavedDefaultOpenScreenRoute(route);
    if (route === '/appointments') setSavedDefaultAppointmentsView(nextView);
    try {
      await patchUserProfile(primaryOrgId, {
        personalDetails: {
          ...profile?.personalDetails,
          pmsPreferences: {
            ...pmsPreferences,
            defaultOpenScreen: routeToDefaultOpenScreen(route),
            appointmentView: localToAppointmentView(nextView),
          },
        },
      });
    } catch {
      notify('error', {
        title: 'Unable to update defaults',
        text: 'Please try again.',
      });
    }
  };

  const handleScreenChange = (value: string) => {
    setSelection(value);
    void persist(value, defaultView);
  };

  const handleViewChange = (value: string) => {
    const nextView = value as DefaultAppointmentsView;
    setDefaultView(nextView);
    void persist(selection, nextView);
  };

  return (
    <>
      <PreferenceRow label="Default open screen" description="Where the app lands after sign-in">
        <PillSelect
          ariaLabel="Default open screen"
          value={selection}
          options={options}
          onChange={handleScreenChange}
        />
      </PreferenceRow>
      {shouldShowDefaultView && (
        <PreferenceRow label="Default appointment view" description="Calendar, board, or list">
          <PillSelect
            ariaLabel="Default appointment view"
            value={defaultView}
            options={APPOINTMENT_VIEW_OPTIONS}
            onChange={handleViewChange}
          />
        </PreferenceRow>
      )}
    </>
  );
};

export default DefaultOpenScreenPreference;
