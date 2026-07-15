import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VitalsForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/VitalsForm';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { saveVitalRecord } from '@/app/features/appointments/services/workspaceClinicalService';
import { listVitalsTemplates } from '@/app/features/appointments/services/workspaceTemplateService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import type { Vitals } from '@/app/features/appointments/types/workspace';

jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  saveVitalRecord: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  listVitalsTemplates: jest.fn(),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

const addVitals = jest.fn();

const baseProps = {
  appointmentId: 'appt-1',
  organisationId: 'org-1',
  encounterId: 'enc-1',
  authorId: 'user-1',
  authorName: 'Dr Vet',
  vitals: [] as Vitals[],
};

describe('VitalsForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAppointmentWorkspaceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ addVitals })
    );
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    (listVitalsTemplates as jest.Mock).mockResolvedValue([]);
    (saveVitalRecord as jest.Mock).mockResolvedValue({ id: 'vital-1' });
  });

  it('shows the empty state and opens the new-vitals form', async () => {
    render(<VitalsForm {...baseProps} />);
    expect(screen.getByText('No vitals recorded yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    expect(await screen.findByText('New vitals')).toBeInTheDocument();
  });

  it('validates required numeric fields and blocks save', async () => {
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    expect(
      await screen.findByText('Please fix the highlighted vitals fields.')
    ).toBeInTheDocument();
    expect(saveVitalRecord).not.toHaveBeenCalled();
  });

  it('updates a draft field via typing, then saves and resets the form', async () => {
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Pain score'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('BCS'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Vitals notes'), { target: { value: 'Looks good' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    await waitFor(() => expect(saveVitalRecord).toHaveBeenCalledTimes(1));
    expect(addVitals).toHaveBeenCalledWith(
      'appt-1',
      expect.objectContaining({ weightLbs: 42, notes: 'Looks good' }),
      'vital-1'
    );

    // Form resets to the list view after a successful save.
    expect(await screen.findByText('No vitals recorded yet.')).toBeInTheDocument();
  });

  it('discards the draft without saving', async () => {
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(await screen.findByText('No vitals recorded yet.')).toBeInTheDocument();
    expect(saveVitalRecord).not.toHaveBeenCalled();

    // Reopening shows a clean draft (reducer RESET bailout didn't leave stale values).
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');
    expect(screen.getByLabelText('Weight')).toHaveValue('');
  });

  it('shows a save error and keeps the form open when the save fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (saveVitalRecord as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Pain score'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('BCS'), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    expect(await screen.findByText('Unable to save vitals. Please try again.')).toBeInTheDocument();
    expect(addVitals).not.toHaveBeenCalled();
    // Still on the form (not reset) after a failed save.
    expect(screen.getByText('New vitals')).toBeInTheDocument();
  });
});
