import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  changeAppointmentStatus: jest.fn(),
}));

const mockChange = changeAppointmentStatus as jest.MockedFunction<typeof changeAppointmentStatus>;

const makeAppointment = (status: string): Appointment =>
  ({ id: 'appt-1', status }) as unknown as Appointment;

describe('AppointmentStatusPill', () => {
  beforeEach(() => {
    mockChange.mockReset();
    mockChange.mockResolvedValue(undefined as never);
  });

  it('renders a read-only badge when no transitions are allowed', () => {
    render(<AppointmentStatusPill appointment={makeAppointment('COMPLETED')} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // No dropdown trigger — it is a static span.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a read-only badge when editing is disabled', () => {
    render(<AppointmentStatusPill appointment={makeAppointment('IN_PROGRESS')} canEdit={false} />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the menu and changes status, firing onChanged', async () => {
    const onChanged = jest.fn();
    render(
      <AppointmentStatusPill appointment={makeAppointment('IN_PROGRESS')} onChanged={onChanged} />
    );
    fireEvent.click(screen.getByRole('button', { name: /in progress/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Completed' }));
    await waitFor(() => expect(mockChange).toHaveBeenCalledTimes(1));
    expect(onChanged).toHaveBeenCalled();
  });

  it('surfaces an error when the status change fails', async () => {
    mockChange.mockRejectedValueOnce(new Error('Network down'));
    render(<AppointmentStatusPill appointment={makeAppointment('IN_PROGRESS')} />);
    fireEvent.click(screen.getByRole('button', { name: /in progress/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Completed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
  });

  it('toggles the menu closed when the trigger is clicked again', () => {
    render(<AppointmentStatusPill appointment={makeAppointment('UPCOMING')} />);
    const trigger = screen.getByRole('button', { name: /upcoming/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('registers the open menu with an anchor and closes on outside pointer down', () => {
    const cleanup = jest.fn();
    const registerAnchorEl = jest.fn(() => cleanup);
    render(
      <AppointmentStatusPill
        appointment={makeAppointment('UPCOMING')}
        registerAnchorEl={registerAnchorEl}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /upcoming/i }));
    expect(registerAnchorEl).toHaveBeenCalled();
    // A pointer-down outside the trigger/menu closes the dropdown.
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(cleanup).toHaveBeenCalled();
  });
});
