import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import DefaultOpenScreenPreference from '@/app/features/settings/pages/Settings/Sections/DefaultOpenScreenPreference';
import { useNotify } from '@/app/hooks/useNotify';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { useOrgStore } from '@/app/stores/orgStore';
import { patchUserProfile } from '@/app/features/organization/services/profileService';
import { setSavedDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';
import { setSavedDefaultAppointmentsView } from '@/app/lib/defaultAppointmentsView';

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

const screenSelect = () => screen.getByLabelText('Default open screen') as HTMLSelectElement;
const viewSelect = () => screen.getByLabelText('Default appointment view') as HTMLSelectElement;

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

  it('renders both preference rows with the design descriptions', () => {
    render(<DefaultOpenScreenPreference />);

    expect(screen.getByText('Default open screen')).toBeInTheDocument();
    expect(screen.getByText('Where the app lands after sign-in')).toBeInTheDocument();
    expect(screen.getByText('Default appointment view')).toBeInTheDocument();
    expect(screen.getByText('Calendar, board, or list')).toBeInTheDocument();
    expect(screenSelect().value).toBe('/appointments');
    expect(viewSelect().value).toBe('board');
  });

  // Auto-save model: the pill commits on change, so there is no Save button and a
  // successful write stays silent (the page header carries the indicator).
  it('saves the dashboard preference as soon as it is picked', async () => {
    render(<DefaultOpenScreenPreference />);

    fireEvent.change(screenSelect(), { target: { value: '/dashboard' } });

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
    // The dashboard route does not carry an appointment view, so the local view
    // cache is left untouched and the second row is hidden.
    expect(setSavedDefaultAppointmentsView).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Default appointment view')).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  });

  it('shows missing org notification and stops', async () => {
    orgState.primaryOrgId = '';

    render(<DefaultOpenScreenPreference />);
    fireEvent.change(screenSelect(), { target: { value: '/dashboard' } });

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
    fireEvent.change(screenSelect(), { target: { value: '/dashboard' } });

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update defaults' })
      );
    });
  });

  // selection stays on '/appointments' -> the view row is rendered; picking Calendar
  // routes appointmentView through localToAppointmentView and writes the local cache.
  it('saves the appointment view against the appointments route', async () => {
    render(<DefaultOpenScreenPreference />);

    fireEvent.change(viewSelect(), { target: { value: 'calendar' } });

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
    expect(setSavedDefaultAppointmentsView).toHaveBeenCalledWith('calendar');
    expect(setSavedDefaultOpenScreenRoute).toHaveBeenCalledWith('/appointments');
  });

  // defaultOpenScreenToRoute('DASHBOARD') -> '/dashboard' -> shouldShowDefaultView false,
  // so the appointment-view row is not rendered on first paint.
  it('hides the appointment view row when the saved screen is the dashboard', () => {
    setProfile({ defaultOpenScreen: 'DASHBOARD', appointmentView: 'STATUS_BOARD' });

    render(<DefaultOpenScreenPreference />);

    expect(screenSelect().value).toBe('/dashboard');
    expect(screen.queryByLabelText('Default appointment view')).toBeNull();
  });

  // appointmentViewToLocal('TABLE') -> 'list' feeds the default appointment view pill.
  it('maps the TABLE appointment view to the local list value', () => {
    setProfile({ defaultOpenScreen: 'APPOINTMENTS', appointmentView: 'TABLE' });

    render(<DefaultOpenScreenPreference />);

    expect(viewSelect().value).toBe('list');
  });

  // Reconcile branch (prevSavedRouteRef.current !== savedRoute): a profile change to DASHBOARD
  // re-derives savedRoute and resets selection, hiding the appointment-view row.
  it('re-syncs selection when the saved route changes between renders', () => {
    const { rerender } = render(<DefaultOpenScreenPreference />);
    expect(viewSelect()).toBeInTheDocument();

    setProfile({ defaultOpenScreen: 'DASHBOARD', appointmentView: 'STATUS_BOARD' });
    rerender(<DefaultOpenScreenPreference />);

    expect(screen.queryByLabelText('Default appointment view')).toBeNull();
    expect(screenSelect().value).toBe('/dashboard');
  });

  // Reconcile branch second operand (route same, only the view changed):
  // prevSavedViewRef.current !== savedView with prevSavedRouteRef.current === savedRoute.
  it('re-syncs the default view when only the saved appointment view changes', () => {
    const { rerender } = render(<DefaultOpenScreenPreference />);
    expect(viewSelect().value).toBe('board');

    setProfile({ defaultOpenScreen: 'APPOINTMENTS', appointmentView: 'CALENDAR' });
    rerender(<DefaultOpenScreenPreference />);

    expect(viewSelect().value).toBe('calendar');
  });

  // profile null -> optional chaining falls back to normalized default preferences,
  // and an org id not present in orgsById exercises the `orgsById[id]?.type` nullish path.
  it('falls back to defaults when the profile and org type are absent', async () => {
    orgState.primaryOrgId = 'org-unknown';
    orgState.orgsById = {};
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue(null);

    render(<DefaultOpenScreenPreference />);
    // defaults: defaultOpenScreen APPOINTMENTS -> '/appointments', appointmentView STATUS_BOARD -> board
    expect(screenSelect().value).toBe('/appointments');
    expect(viewSelect().value).toBe('board');

    fireEvent.change(viewSelect(), { target: { value: 'list' } });
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
