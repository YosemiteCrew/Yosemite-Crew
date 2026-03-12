import React, { useEffect, useMemo, useState } from 'react';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
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

  useEffect(() => {
    setSelection(savedRoute);
    setDefaultView(savedView);
  }, [savedRoute, savedView]);

  const handleSave = async () => {
    if (!primaryOrgId) {
      notify('error', {
        title: 'Organization not selected',
        text: 'Please select an organization and try again.',
      });
      return;
    }
    const route = selection === '/dashboard' ? '/dashboard' : '/appointments';
    const openScreenSaved = setSavedDefaultOpenScreenRoute(route);
    const defaultViewSaved = shouldShowDefaultView
      ? setSavedDefaultAppointmentsView(defaultView)
      : true;
    try {
      await patchUserProfile(primaryOrgId, {
        personalDetails: {
          ...profile?.personalDetails,
          pmsPreferences: {
            ...pmsPreferences,
            defaultOpenScreen: routeToDefaultOpenScreen(route),
            appointmentView: localToAppointmentView(defaultView),
          },
        },
      });
      if (openScreenSaved && defaultViewSaved) {
        notify('success', {
          title: 'Defaults updated',
          text: 'Your default landing screen preferences have been saved.',
        });
        return;
      }
      notify('success', {
        title: 'Defaults updated',
        text: 'Saved to profile. Local cache refresh may require reloading.',
      });
    } catch {
      notify('error', {
        title: 'Unable to update defaults',
        text: 'Please try again.',
      });
    }
  };

  return (
    <div className="border border-card-border rounded-2xl">
      <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
        <div className="text-body-3 text-text-primary">Default open screen</div>
      </div>
      <div className="flex flex-col gap-3 px-6! py-6!">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <LabelDropdown
            placeholder="Default open screen"
            options={options}
            defaultOption={selection}
            onSelect={(option) => setSelection(option.value)}
          />
          {shouldShowDefaultView && (
            <LabelDropdown
              placeholder="Default appointment view"
              options={[
                { value: 'calendar', label: 'Calendar' },
                { value: 'board', label: 'Status Board' },
                { value: 'list', label: 'Table' },
              ]}
              defaultOption={defaultView}
              onSelect={(option) => setDefaultView(option.value as DefaultAppointmentsView)}
            />
          )}
        </div>
        <div className="w-full flex justify-end!">
          <Primary href="#" text="Save defaults" onClick={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default DefaultOpenScreenPreference;
