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
  default: ({ options, onSelect, placeholder, defaultOption }: any) => (
    <div>
      <div>{placeholder}</div>
      <span data-testid={`sel-${placeholder}`}>{defaultOption}</span>
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

  const setProfile = (pmsPreferences: any) =>
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: { pmsPreferences },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    orgState.primaryOrgId = 'org-1';
    orgState.orgsById = { 'org-1': { type: 'HOSPITAL' } };
    (useNotify as jest.Mock).mockReturnValue({ notify });
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) => selector(orgState));
    setProfile({
      defaultOpenScreen: 'APPOINTMENTS',
      appointmentView: 'STATUS_BOARD',
      animalTerminology: 'PATIENT',
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

  // selection stays on '/appointments' -> shouldShowDefaultView true, second dropdown
  // rendered; picking Calendar routes appointmentView through localToAppointmentView.
  it('saves the appointments route with a chosen appointment view', async () => {
    render(<DefaultOpenScreenPreference />);

    // second dropdown is present because default selection is '/appointments'
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));

    await waitFor(() => {
      expect(patchUserProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          personalDetails: expect.objectContaining({
            pmsPreferences: expect.objectContaining({
              defaultOpenScreen: 'APPOINTMENTS',
              appointmentView: 'CALENDAR',
            }),
          }),
        })
      );
    });
    // defaultViewSaved branch: shouldShowDefaultView ? setSavedDefaultAppointmentsView(...) : true
    expect(setSavedDefaultAppointmentsView).toHaveBeenCalledWith('calendar');
    expect(setSavedDefaultOpenScreenRoute).toHaveBeenCalledWith('/appointments');
    expect(notify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ text: 'Your default landing screen preferences have been saved.' })
    );
  });

  // openScreenSaved === false -> `openScreenSaved && defaultViewSaved` short-circuits false
  // -> the fallback "Saved to profile" success notification.
  it('shows the profile-only success message when the local open-screen cache does not persist', async () => {
    (setSavedDefaultOpenScreenRoute as jest.Mock).mockReturnValue(false);

    render(<DefaultOpenScreenPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({
          text: 'Saved to profile. Local cache refresh may require reloading.',
        })
      );
    });
  });

  // defaultViewSaved === false (setSavedDefaultAppointmentsView false) while openScreenSaved true
  // -> `true && false` -> fallback success message.
  it('shows the profile-only success message when the appointment-view cache does not persist', async () => {
    (setSavedDefaultAppointmentsView as jest.Mock).mockReturnValue(false);

    render(<DefaultOpenScreenPreference />);
    // stay on '/appointments' so shouldShowDefaultView is true and the view cache is written
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({
          text: 'Saved to profile. Local cache refresh may require reloading.',
        })
      );
    });
  });

  // defaultOpenScreenToRoute('DASHBOARD') -> '/dashboard' -> shouldShowDefaultView false,
  // so the appointment-view dropdown ('Calendar') is not rendered on first paint.
  it('hides the appointment view dropdown when the saved screen is the dashboard', () => {
    setProfile({ defaultOpenScreen: 'DASHBOARD', appointmentView: 'STATUS_BOARD' });

    render(<DefaultOpenScreenPreference />);

    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calendar' })).toBeNull();
    expect(screen.getByTestId('sel-Default open screen').textContent).toBe('/dashboard');
  });

  // appointmentViewToLocal('TABLE') -> 'list' feeds the default appointment view dropdown.
  it('maps the TABLE appointment view to the local list value', () => {
    setProfile({ defaultOpenScreen: 'APPOINTMENTS', appointmentView: 'TABLE' });

    render(<DefaultOpenScreenPreference />);

    expect(screen.getByTestId('sel-Default appointment view').textContent).toBe('list');
  });

  // Reconcile branch (prevSavedRouteRef.current !== savedRoute): a profile change to DASHBOARD
  // re-derives savedRoute and resets selection, hiding the appointment-view dropdown.
  it('re-syncs selection when the saved route changes between renders', () => {
    const { rerender } = render(<DefaultOpenScreenPreference />);
    expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument();

    setProfile({ defaultOpenScreen: 'DASHBOARD', appointmentView: 'STATUS_BOARD' });
    rerender(<DefaultOpenScreenPreference />);

    expect(screen.queryByRole('button', { name: 'Calendar' })).toBeNull();
    expect(screen.getByTestId('sel-Default open screen').textContent).toBe('/dashboard');
  });

  // Reconcile branch second operand (route same, only the view changed):
  // prevSavedViewRef.current !== savedView with prevSavedRouteRef.current === savedRoute.
  it('re-syncs the default view when only the saved appointment view changes', () => {
    const { rerender } = render(<DefaultOpenScreenPreference />);
    expect(screen.getByTestId('sel-Default appointment view').textContent).toBe('board');

    setProfile({ defaultOpenScreen: 'APPOINTMENTS', appointmentView: 'CALENDAR' });
    rerender(<DefaultOpenScreenPreference />);

    expect(screen.getByTestId('sel-Default appointment view').textContent).toBe('calendar');
  });

  // profile null -> optional chaining falls back to normalized default preferences,
  // and an org id not present in orgsById exercises the `orgsById[id]?.type` nullish path.
  it('falls back to defaults when the profile and org type are absent', async () => {
    orgState.primaryOrgId = 'org-unknown';
    orgState.orgsById = {};
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue(null);

    render(<DefaultOpenScreenPreference />);
    // defaults: defaultOpenScreen APPOINTMENTS -> '/appointments', appointmentView STATUS_BOARD -> board
    expect(screen.getByTestId('sel-Default open screen').textContent).toBe('/appointments');
    expect(screen.getByTestId('sel-Default appointment view').textContent).toBe('board');

    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));
    await waitFor(() => {
      expect(patchUserProfile).toHaveBeenCalledWith(
        'org-unknown',
        expect.objectContaining({
          personalDetails: expect.objectContaining({
            pmsPreferences: expect.objectContaining({ defaultOpenScreen: 'APPOINTMENTS' }),
          }),
        })
      );
    });
  });
});
