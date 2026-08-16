import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  // Auto-save model: the fields commit on blur, there is no Save button, and a
  // successful write is reported by the page header's "Changes save automatically"
  // indicator rather than a toast.
  it('persists new values when the field is left', () => {
    render(<AppointmentLockWindowPreference />);
    fireEvent.change(screen.getByLabelText('Outpatient'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Inpatient'), { target: { value: '48' } });
    fireEvent.blur(screen.getByLabelText('Inpatient'));

    expect(getSavedLockWindow()).toEqual({ outpatientHours: 12, inpatientHours: 48 });
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not re-persist when the committed values are unchanged', () => {
    render(<AppointmentLockWindowPreference />);
    fireEvent.blur(screen.getByLabelText('Outpatient'));

    expect(setSavedLockWindow).not.toHaveBeenCalled();
    expect(updateOrg).not.toHaveBeenCalled();
  });

  it('clamps out-of-range values on commit and reflects them in the inputs', () => {
    render(<AppointmentLockWindowPreference />);
    fireEvent.change(screen.getByLabelText('Outpatient'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Inpatient'), { target: { value: '100000' } });
    fireEvent.blur(screen.getByLabelText('Inpatient'));

    const saved = getSavedLockWindow();
    expect(saved.outpatientHours).toBe(1);
    expect(saved.inpatientHours).toBe(720);
    expect((screen.getByLabelText('Outpatient') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('Inpatient') as HTMLInputElement).value).toBe('720');
  });

  it('commits when Enter is pressed in a field, and ignores other keys', () => {
    render(<AppointmentLockWindowPreference />);
    const outpatient = screen.getByLabelText('Outpatient') as HTMLInputElement;
    outpatient.focus();

    fireEvent.change(outpatient, { target: { value: '9' } });
    // A non-Enter key leaves the field focused, so nothing is committed yet.
    fireEvent.keyDown(outpatient, { key: 'a' });
    expect(setSavedLockWindow).not.toHaveBeenCalled();

    fireEvent.keyDown(outpatient, { key: 'Enter' });
    expect(getSavedLockWindow().outpatientHours).toBe(9);
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
    fireEvent.blur(screen.getByLabelText('Inpatient'));

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
    fireEvent.change(screen.getByLabelText('Outpatient'), { target: { value: '7' } });
    fireEvent.blur(screen.getByLabelText('Outpatient'));
    expect(notify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Unable to update lock window' })
    );
  });

  // Mirror branch: when the org carries both minute extensions they are converted to hours,
  // written to local storage, and re-synced into the inputs (typeof ... === 'number' && ... path
  // plus the orgKey !== prevOrgMinutes then/else and the saved-window resync).
  it('mirrors the org lock-window minute extensions into local storage and inputs', () => {
    (updateOrg as jest.Mock).mockResolvedValue(undefined);
    useOrgStore.setState({
      orgsById: {
        'org-1': {
          _id: 'org-1',
          name: 'Clinic',
          type: 'HOSPITAL',
          phoneNo: '1',
          taxId: 't',
          appointmentLockWindowOutpatientMinutes: 720, // 12h
          appointmentLockWindowInpatientMinutes: 2880, // 48h
        },
      },
      primaryOrgId: 'org-1',
    });

    render(<AppointmentLockWindowPreference />);

    expect((screen.getByLabelText('Outpatient') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('Inpatient') as HTMLInputElement).value).toBe('48');
    expect(getSavedLockWindow()).toEqual({ outpatientHours: 12, inpatientHours: 48 });
  });

  // `typeof orgOutMinutes === 'number' && typeof orgInMinutes === 'number'` second operand false:
  // outpatient minutes present but inpatient absent -> mirror is skipped, inputs stay default.
  it('does not mirror when only one minute extension is present', () => {
    useOrgStore.setState({
      orgsById: {
        'org-1': {
          _id: 'org-1',
          name: 'Clinic',
          type: 'HOSPITAL',
          phoneNo: '1',
          taxId: 't',
          appointmentLockWindowOutpatientMinutes: 600,
        },
      },
      primaryOrgId: 'org-1',
    });

    render(<AppointmentLockWindowPreference />);

    expect((screen.getByLabelText('Outpatient') as HTMLInputElement).value).toBe('24');
    expect((screen.getByLabelText('Inpatient') as HTMLInputElement).value).toBe('24');
    expect(getSavedLockWindow()).toEqual({ outpatientHours: 24, inpatientHours: 24 });
  });

  // The best-effort org push rejects: the `.catch(() => {})` handler runs and local persistence
  // still succeeds silently.
  it('swallows a failed org push while keeping the local write', async () => {
    (updateOrg as jest.Mock).mockRejectedValue(new Error('boom'));
    useOrgStore.setState({
      orgsById: {
        'org-1': { _id: 'org-1', name: 'Clinic', type: 'HOSPITAL', phoneNo: '1', taxId: 't' },
      },
      primaryOrgId: 'org-1',
    });

    render(<AppointmentLockWindowPreference />);
    fireEvent.change(screen.getByLabelText('Outpatient'), { target: { value: '5' } });
    fireEvent.blur(screen.getByLabelText('Outpatient'));

    await waitFor(() => expect(updateOrg).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });

    expect(getSavedLockWindow().outpatientHours).toBe(5);
    expect(notify).not.toHaveBeenCalled();
  });
});
