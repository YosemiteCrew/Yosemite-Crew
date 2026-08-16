import React, { useMemo, useState } from 'react';
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
import { PreferenceRow } from './PreferenceGroup';
import PillSelect from './PillSelect';

/** Sentinel option value standing for "follow the device timezone". */
const DEVICE_VALUE = 'device';

const TimezonePreference = () => {
  const { notify } = useNotify();
  const profile = usePrimaryOrgProfile();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const profileTimezone = parseTimezoneFromProfile(profile?.personalDetails?.timezone);
  const [syncMode, setSyncMode] = useState<TimezoneSyncMode>(() =>
    getTimezoneSyncModeForOrg(primaryOrgId)
  );
  const [selectedTimezone, setSelectedTimezone] = useState<string>(profileTimezone);

  // Render-phase adjustment (React's documented setState-during-render reset
  // pattern): re-seed the pill whenever the org or the profile's saved timezone
  // changes.
  const [prevOrgId, setPrevOrgId] = useState(primaryOrgId);
  const [prevProfileTimezone, setPrevProfileTimezone] = useState(profileTimezone);
  if (prevOrgId !== primaryOrgId || prevProfileTimezone !== profileTimezone) {
    setPrevOrgId(primaryOrgId);
    setPrevProfileTimezone(profileTimezone);
    const nextSyncMode = getTimezoneSyncModeForOrg(primaryOrgId);
    setSyncMode(nextSyncMode);
    setSelectedTimezone(nextSyncMode === 'device' ? getSystemTimeZone() : profileTimezone);
  }

  // The design collapses the mode + zone pair into a single compact pill whose
  // first entry is the device zone ("Device · Europe/Berlin") and whose remaining
  // entries pin an explicit zone.
  const options = useMemo(
    () => [{ value: DEVICE_VALUE, label: `Device · ${getSystemTimeZone()}` }, ...timezoneOptions],
    [timezoneOptions]
  );

  // Auto-save model from the design: the pill commits on change and the page header
  // carries the single "Changes save automatically" indicator, so there is no
  // per-preference Save button. Only failures surface a notification.
  const persist = async (mode: TimezoneSyncMode, timezone: string) => {
    if (!primaryOrgId) {
      notify('error', {
        title: 'Organization not selected',
        text: 'Please select an organization and try again.',
      });
      return;
    }

    const next = mode === 'device' ? getSystemTimeZone() : timezone || DEFAULT_TIMEZONE;
    setPreferredTimeZone(next);
    setTimezoneSyncModeForOrg(primaryOrgId, mode);

    try {
      await patchUserProfile(primaryOrgId, {
        personalDetails: {
          ...profile?.personalDetails,
          timezone: next,
        },
      });
    } catch {
      notify('error', {
        title: 'Unable to update timezone',
        text: 'Please choose a valid timezone and try again.',
      });
    }
  };

  const handleChange = (value: string) => {
    const mode: TimezoneSyncMode = value === DEVICE_VALUE ? 'device' : 'custom';
    const timezone = mode === 'device' ? getSystemTimeZone() : value;
    setSyncMode(mode);
    setSelectedTimezone(timezone);
    void persist(mode, timezone);
  };

  return (
    <PreferenceRow label="Timezone" description="Used for slots and reminders">
      <PillSelect
        ariaLabel="Timezone"
        value={syncMode === 'device' ? DEVICE_VALUE : selectedTimezone}
        options={options}
        onChange={handleChange}
      />
    </PreferenceRow>
  );
};

export default TimezonePreference;
