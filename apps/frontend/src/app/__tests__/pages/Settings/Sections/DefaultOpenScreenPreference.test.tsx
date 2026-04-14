import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import DefaultOpenScreenPreference from '@/app/features/settings/pages/Settings/Sections/DefaultOpenScreenPreference';
import { useNotify } from '@/app/hooks/useNotify';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { useOrgStore } from '@/app/stores/orgStore';
import { patchUserProfile } from '@/app/features/organization/services/profileService';
import { setSavedDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';
import { setSavedDefaultAppointmentsView } from '@/app/lib/defaultAppointmentsView';

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
jest.mock('@/app/lib/defaultOpenScreen', () => ({
  ...jest.requireActual('@/app/lib/defaultOpenScreen'),
  setSavedDefaultOpenScreenRoute: jest.fn(),
}));
jest.mock('@/app/lib/defaultAppointmentsView', () => ({
  ...jest.requireActual('@/app/lib/defaultAppointmentsView'),
  setSavedDefaultAppointmentsView: jest.fn(),
}));

describe('DefaultOpenScreenPreference', () => {
  const notify = jest.fn();
  const orgState: any = { primaryOrgId: 'org-1', orgsById: { 'org-1': { type: 'HOSPITAL' } } };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify });
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) => selector(orgState));
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: {
        pmsPreferences: {
          defaultOpenScreen: 'APPOINTMENTS',
          appointmentView: 'STATUS_BOARD',
          animalTerminology: 'PATIENT',
        },
      },
    });
    (patchUserProfile as jest.Mock).mockResolvedValue({});
    (setSavedDefaultOpenScreenRoute as jest.Mock).mockReturnValue(true);
    (setSavedDefaultAppointmentsView as jest.Mock).mockReturnValue(true);
  });

  it('saves dashboard preference successfully', async () => {
    render(<DefaultOpenScreenPreference />);

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));

    await waitFor(() => {
      expect(patchUserProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          personalDetails: expect.objectContaining({
            pmsPreferences: expect.objectContaining({ defaultOpenScreen: 'DASHBOARD' }),
          }),
        })
      );
    });

    expect(setSavedDefaultOpenScreenRoute).toHaveBeenCalledWith('/dashboard');
    expect(notify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Defaults updated' })
    );
  });

  it('shows missing org notification and stops', async () => {
    orgState.primaryOrgId = '';

    render(<DefaultOpenScreenPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Organization not selected' })
      );
    });
    expect(patchUserProfile).not.toHaveBeenCalled();

    orgState.primaryOrgId = 'org-1';
  });

  it('shows error notification when patch fails', async () => {
    (patchUserProfile as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<DefaultOpenScreenPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update defaults' })
      );
    });
  });
});
