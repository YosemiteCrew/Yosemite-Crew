import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentLockWindowPreference from '@/app/features/settings/pages/Settings/Sections/AppointmentLockWindowPreference';
import { useNotify } from '@/app/hooks/useNotify';
import { getSavedLockWindow, setSavedLockWindow } from '@/app/lib/appointmentLockWindow';

jest.mock('@/app/hooks/useNotify', () => ({ useNotify: jest.fn() }));
jest.mock('@/app/features/organization/services/orgService', () => ({ updateOrg: jest.fn() }));
import { updateOrg } from '@/app/features/organization/services/orgService';
import { useOrgStore } from '@/app/stores/orgStore';
jest.mock('@/app/lib/appointmentLockWindow', () => ({
  ...jest.requireActual('@/app/lib/appointmentLockWindow'),
  setSavedLockWindow: jest.fn(
    jest.requireActual('@/app/lib/appointmentLockWindow').setSavedLockWindow
  ),
}));

describe('AppointmentLockWindowPreference', () => {
  const notify = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    useOrgStore.setState({ orgsById: {}, primaryOrgId: null });
    (useNotify as jest.Mock).mockReturnValue({ notify });
  });

  it('renders the default 24h values', () => {
    render(<AppointmentLockWindowPreference />);
    expect((screen.getByLabelText('Outpatient') as HTMLInputElement).value).toBe('24');
    expect((screen.getByLabelText('Inpatient') as HTMLInputElement).value).toBe('24');
  });

  it('saves new values and persists them', () => {
    render(<AppointmentLockWindowPreference />);
    fireEvent.change(screen.getByLabelText('Outpatient'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Inpatient'), { target: { value: '48' } });
    fireEvent.click(screen.getByText('Save lock window'));

    expect(getSavedLockWindow()).toEqual({ outpatientHours: 12, inpatientHours: 48 });
    expect(notify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Lock window updated' })
    );
  });

  it('clamps out-of-range values on save and reflects them in the inputs', () => {
    render(<AppointmentLockWindowPreference />);
    fireEvent.change(screen.getByLabelText('Outpatient'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Inpatient'), { target: { value: '100000' } });
    fireEvent.click(screen.getByText('Save lock window'));

    const saved = getSavedLockWindow();
    expect(saved.outpatientHours).toBe(1);
    expect(saved.inpatientHours).toBe(720);
    expect((screen.getByLabelText('Outpatient') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('Inpatient') as HTMLInputElement).value).toBe('720');
  });

  it('hydrates inputs from a previously saved window', () => {
    window.localStorage.setItem(
      'yc_appointment_lock_window',
      JSON.stringify({ outpatientHours: 6, inpatientHours: 36 })
    );
    render(<AppointmentLockWindowPreference />);
    expect((screen.getByLabelText('Outpatient') as HTMLInputElement).value).toBe('6');
    expect((screen.getByLabelText('Inpatient') as HTMLInputElement).value).toBe('36');
  });

  it('also pushes the window to the org as minute FHIR extensions when a primary org exists', () => {
    (updateOrg as jest.Mock).mockResolvedValue(undefined);
    useOrgStore.setState({
      orgsById: {
        'org-1': { _id: 'org-1', name: 'Clinic', type: 'HOSPITAL', phoneNo: '1', taxId: 't' },
      },
      primaryOrgId: 'org-1',
    });

    render(<AppointmentLockWindowPreference />);
    fireEvent.change(screen.getByLabelText('Outpatient'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Inpatient'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Save lock window'));

    expect(updateOrg).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'org-1',
        appointmentLockWindowOutpatientMinutes: 120,
        appointmentLockWindowInpatientMinutes: 180,
      })
    );
  });

  it('notifies an error when persistence fails', () => {
    (setSavedLockWindow as jest.Mock).mockReturnValueOnce(false);
    render(<AppointmentLockWindowPreference />);
    fireEvent.click(screen.getByText('Save lock window'));
    expect(notify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Unable to update lock window' })
    );
  });
});
