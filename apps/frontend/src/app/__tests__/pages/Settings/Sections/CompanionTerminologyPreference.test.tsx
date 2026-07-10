import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanionTerminologyPreference from '@/app/features/settings/pages/Settings/Sections/CompanionTerminologyPreference';
import { useOrgStore } from '@/app/stores/orgStore';
import { useNotify } from '@/app/hooks/useNotify';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { patchUserProfile } from '@/app/features/organization/services/profileService';
import { setCompanionTerminologyForOrg } from '@/app/lib/companionTerminology';
import { useRouter } from 'next/navigation';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/hooks/useProfiles', () => ({
  usePrimaryOrgProfile: jest.fn(),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  patchUserProfile: jest.fn(),
}));

jest.mock('@/app/lib/companionTerminology', () => ({
  ...jest.requireActual('@/app/lib/companionTerminology'),
  setCompanionTerminologyForOrg: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('CompanionTerminologyPreference', () => {
  const notifyMock = jest.fn();
  const refreshMock = jest.fn();

  const orgState: any = {
    primaryOrgId: 'org-1',
    orgsById: { 'org-1': { type: 'HOSPITAL' } },
  };

  const setProfile = (pmsPreferences: any) =>
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: { pmsPreferences },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    orgState.primaryOrgId = 'org-1';
    orgState.orgsById = { 'org-1': { type: 'HOSPITAL' } };
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
    (useRouter as jest.Mock).mockReturnValue({ refresh: refreshMock });
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) => selector(orgState));
    setProfile({ animalTerminology: 'COMPANION' });
    (setCompanionTerminologyForOrg as jest.Mock).mockReturnValue(true);
    (patchUserProfile as jest.Mock).mockResolvedValue({});
  });

  it('saves terminology and refreshes router when a new option is picked', async () => {
    render(<CompanionTerminologyPreference />);

    fireEvent.click(screen.getByRole('button', { name: 'Patients' }));

    await waitFor(() => {
      expect(setCompanionTerminologyForOrg).toHaveBeenCalledWith('org-1', 'PATIENT');
    });
    expect(patchUserProfile).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        personalDetails: expect.objectContaining({
          pmsPreferences: expect.objectContaining({ animalTerminology: 'PATIENT' }),
        }),
      })
    );
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Terminology updated' })
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it('does nothing when the already-active option is clicked', () => {
    render(<CompanionTerminologyPreference />);

    fireEvent.click(screen.getByRole('button', { name: 'Companions' }));

    expect(setCompanionTerminologyForOrg).not.toHaveBeenCalled();
    expect(patchUserProfile).not.toHaveBeenCalled();
  });

  it('shows missing-org error and does not patch profile', async () => {
    orgState.primaryOrgId = undefined;

    render(<CompanionTerminologyPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Patients' }));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Organization not selected' })
      );
    });
    expect(patchUserProfile).not.toHaveBeenCalled();

    orgState.primaryOrgId = 'org-1';
  });

  it('shows backend error notification when patch fails', async () => {
    (patchUserProfile as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<CompanionTerminologyPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Patients' }));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update terminology' })
      );
    });
  });

  // isValidAnimalTerminology(undefined) === false -> selection falls back to the
  // org-type default. For a HOSPITAL org that default is 'PATIENT'.
  it('seeds the selection from the org-type default when the profile terminology is missing', () => {
    setProfile({});

    render(<CompanionTerminologyPreference />);

    expect(screen.getByRole('button', { name: 'Patients' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  // Non-hospital org type -> fallback is 'COMPANION' (invalid stored value routed to fallback).
  it('falls back to companion terminology for a non-hospital org type', () => {
    orgState.orgsById = { 'org-1': { type: 'GROOMER' } };
    setProfile({ animalTerminology: 'NOT_A_REAL_OPTION' });

    render(<CompanionTerminologyPreference />);

    expect(screen.getByRole('button', { name: 'Companions' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  // localSaved === false -> the profile-only success notification.
  it('shows the profile-only success message when the local cache does not persist', async () => {
    (setCompanionTerminologyForOrg as jest.Mock).mockReturnValue(false);

    render(<CompanionTerminologyPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Patients' }));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({
          text: 'Saved to profile. Local cache refresh may require reloading.',
        })
      );
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  // Reconcile branch: profileTerminology changes between renders -> selection re-syncs.
  it('re-syncs the selection when the profile terminology changes', () => {
    const { rerender } = render(<CompanionTerminologyPreference />);

    setProfile({ animalTerminology: 'ANIMAL' });
    rerender(<CompanionTerminologyPreference />);

    expect(screen.getByRole('button', { name: 'Animals' })).toHaveAttribute('aria-pressed', 'true');
  });

  // profile null -> optional chaining resolves to the fallback terminology and the
  // save still runs (spread of an absent personalDetails).
  it('handles an absent profile via the fallback terminology', async () => {
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue(null);

    render(<CompanionTerminologyPreference />);
    // fallback for HOSPITAL is PATIENT, so pick a different option to trigger a save
    fireEvent.click(screen.getByRole('button', { name: 'Companions' }));

    await waitFor(() => {
      expect(setCompanionTerminologyForOrg).toHaveBeenCalledWith('org-1', 'COMPANION');
    });
    expect(patchUserProfile).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        personalDetails: expect.objectContaining({
          pmsPreferences: expect.objectContaining({ animalTerminology: 'COMPANION' }),
        }),
      })
    );
  });
});
