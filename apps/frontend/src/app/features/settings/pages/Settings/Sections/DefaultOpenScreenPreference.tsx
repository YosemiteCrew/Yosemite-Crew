import React, { useMemo, useState } from 'react';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
import { useNotify } from '@/app/hooks/useNotify';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import {
  DefaultOpenScreenRoute,
  getRoleDefaultOpenScreenRoute,
  getSavedDefaultOpenScreenRoute,
  setSavedDefaultOpenScreenRoute,
} from '@/app/lib/defaultOpenScreen';
import {
  DefaultAppointmentsView,
  getSavedDefaultAppointmentsView,
  setSavedDefaultAppointmentsView,
} from '@/app/lib/defaultAppointmentsView';

const ROLE_DEFAULT_VALUE = 'ROLE_DEFAULT';

const DefaultOpenScreenPreference = () => {
  const { notify } = useNotify();
  const { membership } = usePrimaryOrgWithMembership();
  const role = membership?.roleDisplay ?? membership?.roleCode;
  const roleDefaultRoute = getRoleDefaultOpenScreenRoute(role);
  const savedRoute = getSavedDefaultOpenScreenRoute();

  const options = useMemo(
    () => [
      {
        value: ROLE_DEFAULT_VALUE,
        label: `Role default (${roleDefaultRoute === '/dashboard' ? 'Dashboard' : 'Appointments'})`,
      },
      { value: '/dashboard', label: 'Dashboard' },
      { value: '/appointments', label: 'Appointments' },
    ],
    [roleDefaultRoute]
  );

  const [selection, setSelection] = useState<string>(savedRoute ?? ROLE_DEFAULT_VALUE);
  const [defaultView, setDefaultView] = useState<DefaultAppointmentsView>(
    getSavedDefaultAppointmentsView() ?? 'board'
  );
  const resolvedRoute =
    selection === ROLE_DEFAULT_VALUE ? roleDefaultRoute : (selection as DefaultOpenScreenRoute);
  const shouldShowDefaultView = resolvedRoute === '/appointments';

  const handleSave = () => {
    const route = selection === ROLE_DEFAULT_VALUE ? null : (selection as DefaultOpenScreenRoute);
    const openScreenSaved = setSavedDefaultOpenScreenRoute(route);
    const defaultViewSaved = shouldShowDefaultView
      ? setSavedDefaultAppointmentsView(defaultView)
      : true;
    const ok = openScreenSaved && defaultViewSaved;
    if (ok) {
      notify('success', {
        title: 'Defaults updated',
        text: 'Your default landing screen preferences have been saved.',
      });
      return;
    }
    notify('error', {
      title: 'Unable to update defaults',
      text: 'Please try again.',
    });
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
