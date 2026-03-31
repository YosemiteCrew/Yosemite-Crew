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

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ options, onSelect }: any) => (
    <div>
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

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
    (useRouter as jest.Mock).mockReturnValue({ refresh: refreshMock });
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) => selector(orgState));
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: {
        pmsPreferences: { animalTerminology: 'COMPANION' },
      },
    });
    (setCompanionTerminologyForOrg as jest.Mock).mockReturnValue(true);
    (patchUserProfile as jest.Mock).mockResolvedValue({});
  });

  it('saves terminology and refreshes router on success', async () => {
    render(<CompanionTerminologyPreference />);

    fireEvent.click(screen.getByRole('button', { name: 'Patient / Patients' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save terminology' }));

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

  it('shows missing-org error and does not patch profile', async () => {
    orgState.primaryOrgId = undefined;

    render(<CompanionTerminologyPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Save terminology' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Save terminology' }));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update terminology' })
      );
    });
  });
});
