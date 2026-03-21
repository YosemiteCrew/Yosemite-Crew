import React, { useEffect, useMemo, useState } from 'react';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
import {
  DEFAULT_TIMEZONE,
  getSystemTimeZone,
  getTimezoneSyncModeForOrg,
  getTimezoneOptions,
  setPreferredTimeZone,
  setTimezoneSyncModeForOrg,
  TimezoneSyncMode,
} from '@/app/lib/timezone';
import { useNotify } from '@/app/hooks/useNotify';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { useOrgStore } from '@/app/stores/orgStore';
import { parseTimezoneFromProfile } from '@/app/features/settings/utils/pmsPreferences';
import { patchUserProfile } from '@/app/features/organization/services/profileService';

const TimezonePreference = () => {
  const { notify } = useNotify();
  const profile = usePrimaryOrgProfile();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const options = useMemo(() => getTimezoneOptions(), []);
  const modeOptions = useMemo(
    () => [
      { value: 'device', label: 'Use device timezone' },
      { value: 'custom', label: 'Use custom timezone' },
    ],
    []
  );
  const profileTimezone = parseTimezoneFromProfile(profile?.personalDetails?.timezone);
  const [syncMode, setSyncMode] = useState<TimezoneSyncMode>(
    getTimezoneSyncModeForOrg(primaryOrgId)
  );
  const [selectedTimezone, setSelectedTimezone] = useState<string>(profileTimezone);

  useEffect(() => {
    const nextSyncMode = getTimezoneSyncModeForOrg(primaryOrgId);
    setSyncMode(nextSyncMode);
    if (nextSyncMode === 'device') {
      setSelectedTimezone(getSystemTimeZone());
      return;
    }
    setSelectedTimezone(profileTimezone);
  }, [primaryOrgId, profileTimezone]);

  const handleSave = async () => {
    if (!primaryOrgId) {
      notify('error', {
        title: 'Organization not selected',
        text: 'Please select an organization and try again.',
      });
      return;
    }

    const next = syncMode === 'device' ? getSystemTimeZone() : selectedTimezone || DEFAULT_TIMEZONE;
    const localSaved = setPreferredTimeZone(next);
    const modeSaved = setTimezoneSyncModeForOrg(primaryOrgId, syncMode);

    try {
      await patchUserProfile(primaryOrgId, {
        personalDetails: {
          ...profile?.personalDetails,
          timezone: next,
        },
      });
      if (localSaved && modeSaved) {
        notify('success', {
          title: 'Timezone updated',
          text:
            syncMode === 'device'
              ? 'Device timezone mode is enabled and synced with backend.'
              : 'Custom timezone preference has been saved.',
        });
        return;
      }
      notify('success', {
        title: 'Timezone updated',
        text: 'Timezone synced with backend. Local cache refresh may require reloading.',
      });
      return;
    } catch {
      notify('error', {
        title: 'Unable to update timezone',
        text: 'Please choose a valid timezone and try again.',
      });
    }
  };

  return (
    <div className="border border-card-border rounded-2xl">
      <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
        <div className="text-body-3 text-text-primary">Timezone</div>
      </div>
      <div className="flex flex-col gap-3 px-6! py-6!">
        <LabelDropdown
          placeholder="Timezone mode"
          options={modeOptions}
          defaultOption={syncMode}
          onSelect={(option) => setSyncMode(option.value as TimezoneSyncMode)}
        />
        {syncMode === 'custom' ? (
          <LabelDropdown
            placeholder="Preferred timezone"
            options={options}
            defaultOption={selectedTimezone}
            onSelect={(option) => setSelectedTimezone(option.value)}
          />
        ) : (
          <div className="px-6 py-[11px] border border-input-border-default rounded-2xl text-body-4 text-text-secondary">
            Device timezone: {getSystemTimeZone()}
          </div>
        )}
        <div className="w-full flex justify-end!">
          <Primary href="#" text="Save timezone" onClick={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default TimezonePreference;
