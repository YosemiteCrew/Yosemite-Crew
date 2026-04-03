import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ options, onSelect, placeholder }: any) => (
    <div>
      <div>{placeholder}</div>
      {options.map((option: any) => (
        <button key={option.value} type="button" onClick={() => onSelect(option)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

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

describe('TimezonePreference', () => {
  const notify = jest.fn();
  const orgState: any = { primaryOrgId: 'org-1' };

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('saves custom timezone', async () => {
    render(<TimezonePreference />);

    fireEvent.click(screen.getByRole('button', { name: 'Use custom timezone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Berlin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save timezone' }));

    await waitFor(() => {
      expect(setTimezoneSyncModeForOrg).toHaveBeenCalledWith('org-1', 'custom');
      expect(patchUserProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          personalDetails: expect.objectContaining({ timezone: 'Europe/Berlin' }),
        })
      );
    });
    expect(notify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Timezone updated' })
    );
  });

  it('shows missing org error', async () => {
    orgState.primaryOrgId = '';

    render(<TimezonePreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Save timezone' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Save timezone' }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update timezone' })
      );
    });
  });
});
