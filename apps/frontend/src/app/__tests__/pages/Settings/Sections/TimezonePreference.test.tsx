import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import TimezonePreference from '@/app/features/settings/pages/Settings/Sections/TimezonePreference';
import { useNotify } from '@/app/hooks/useNotify';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { useOrgStore } from '@/app/stores/orgStore';
import { patchUserProfile } from '@/app/features/organization/services/profileService';
import {
  getSystemTimeZone,
  getTimezoneOptions,
  getTimezoneSyncModeForOrg,
  setPreferredTimeZone,
  setTimezoneSyncModeForOrg,
} from '@/app/lib/timezone';

jest.mock('@/app/hooks/useNotify', () => ({ useNotify: jest.fn() }));
jest.mock('@/app/hooks/useProfiles', () => ({ usePrimaryOrgProfile: jest.fn() }));
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/features/organization/services/profileService', () => ({
  patchUserProfile: jest.fn(),
}));
jest.mock('@/app/lib/timezone', () => ({
  ...jest.requireActual('@/app/lib/timezone'),
  getTimezoneOptions: jest.fn(),
  getTimezoneSyncModeForOrg: jest.fn(),
  getSystemTimeZone: jest.fn(),
  setPreferredTimeZone: jest.fn(),
  setTimezoneSyncModeForOrg: jest.fn(),
}));

const pill = () => screen.getByLabelText('Timezone') as HTMLSelectElement;

describe('TimezonePreference', () => {
  const notify = jest.fn();
  const orgState: any = { primaryOrgId: 'org-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    orgState.primaryOrgId = 'org-1';
    (useNotify as jest.Mock).mockReturnValue({ notify });
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) => selector(orgState));
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: { timezone: 'Europe/Berlin' },
    });
    (getTimezoneOptions as jest.Mock).mockReturnValue([
      { value: 'Europe/Berlin', label: 'Berlin' },
      { value: 'Asia/Kolkata', label: 'Kolkata' },
    ]);
    (getTimezoneSyncModeForOrg as jest.Mock).mockReturnValue('device');
    (getSystemTimeZone as jest.Mock).mockReturnValue('Asia/Kolkata');
    (setPreferredTimeZone as jest.Mock).mockReturnValue(true);
    (setTimezoneSyncModeForOrg as jest.Mock).mockReturnValue(true);
    (patchUserProfile as jest.Mock).mockResolvedValue({});
  });

  it('renders the preference row with the device zone selected', () => {
    render(<TimezonePreference />);

    expect(screen.getByText('Timezone')).toBeInTheDocument();
    expect(screen.getByText('Used for slots and reminders')).toBeInTheDocument();
    expect(pill().value).toBe('device');
    expect(screen.getByRole('option', { name: 'Device · Asia/Kolkata' })).toBeInTheDocument();
  });

  // Auto-save model: the pill commits on change, so there is no Save button and a
  // successful write stays silent (the page header carries the indicator).
  it('pins a custom zone as soon as it is picked', async () => {
    render(<TimezonePreference />);

    fireEvent.change(pill(), { target: { value: 'Europe/Berlin' } });

    await waitFor(() => {
      expect(setTimezoneSyncModeForOrg).toHaveBeenCalledWith('org-1', 'custom');
      expect(patchUserProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          personalDetails: expect.objectContaining({ timezone: 'Europe/Berlin' }),
        })
      );
    });
    expect(setPreferredTimeZone).toHaveBeenCalledWith('Europe/Berlin');
    expect(pill().value).toBe('Europe/Berlin');
    expect(notify).not.toHaveBeenCalled();
  });

  // getTimezoneSyncModeForOrg returns 'custom' on mount -> the effect's custom branch
  // seeds the pill from the profile; switching back to the sentinel restores device mode.
  it('hydrates custom mode and switches back to the device zone', async () => {
    (getTimezoneSyncModeForOrg as jest.Mock).mockReturnValue('custom');

    render(<TimezonePreference />);
    expect(pill().value).toBe('Europe/Berlin');

    fireEvent.change(pill(), { target: { value: 'device' } });

    await waitFor(() => {
      expect(setTimezoneSyncModeForOrg).toHaveBeenCalledWith('org-1', 'device');
      expect(patchUserProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          personalDetails: expect.objectContaining({ timezone: 'Asia/Kolkata' }),
        })
      );
    });
    expect(setPreferredTimeZone).toHaveBeenCalledWith('Asia/Kolkata');
    expect(pill().value).toBe('device');
  });

  it('shows missing org error', async () => {
    orgState.primaryOrgId = '';

    render(<TimezonePreference />);
    fireEvent.change(pill(), { target: { value: 'Europe/Berlin' } });

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Organization not selected' })
      );
    });
    expect(patchUserProfile).not.toHaveBeenCalled();

    orgState.primaryOrgId = 'org-1';
  });

  it('shows backend error when patch fails', async () => {
    (patchUserProfile as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<TimezonePreference />);
    fireEvent.change(pill(), { target: { value: 'Europe/Berlin' } });

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update timezone' })
      );
    });
  });

  // A custom option with an empty value -> `timezone || DEFAULT_TIMEZONE` falls through
  // to DEFAULT_TIMEZONE ('Europe/Berlin').
  it('falls back to the default timezone when the custom selection is empty', async () => {
    (getTimezoneOptions as jest.Mock).mockReturnValue([
      { value: '', label: 'Empty TZ' },
      { value: 'Europe/Berlin', label: 'Berlin' },
    ]);

    render(<TimezonePreference />);
    fireEvent.change(pill(), { target: { value: '' } });

    await waitFor(() => {
      expect(setPreferredTimeZone).toHaveBeenCalledWith('Europe/Berlin');
      expect(patchUserProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          personalDetails: expect.objectContaining({ timezone: 'Europe/Berlin' }),
        })
      );
    });
  });

  // profile null -> parseTimezoneFromProfile(undefined) resolves to the default timezone;
  // exercises the optional chaining on profile?.personalDetails.
  it('handles an absent profile by using the default timezone', async () => {
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue(null);
    (getTimezoneSyncModeForOrg as jest.Mock).mockReturnValue('custom');

    render(<TimezonePreference />);
    expect(pill().value).toBe('Europe/Berlin');

    fireEvent.change(pill(), { target: { value: 'Asia/Kolkata' } });

    await waitFor(() => {
      expect(patchUserProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          personalDetails: expect.objectContaining({ timezone: 'Asia/Kolkata' }),
        })
      );
    });
  });
});
