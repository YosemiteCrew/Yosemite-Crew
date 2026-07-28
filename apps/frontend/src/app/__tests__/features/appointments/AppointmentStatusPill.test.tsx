import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import { getAppointmentStatusTone } from '@/app/config/statusConfig';
import { patchData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  changeAppointmentStatus: jest.fn(),
}));

// Mocked deps of the *real* service module, used by the integration block below.
// jest.requireActual only un-mocks the named module, so the real service still
// resolves these mocked dependencies.
jest.mock('@/app/services/axios');
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: { getState: jest.fn() } }));
jest.mock('@/app/stores/appointmentStore', () => ({
  useAppointmentStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));

const mockChange = changeAppointmentStatus as jest.MockedFunction<typeof changeAppointmentStatus>;

const makeAppointment = (status: string, overrides: Partial<Appointment> = {}): Appointment =>
  ({ id: 'appt-1', status, ...overrides }) as unknown as Appointment;

describe('AppointmentStatusPill', () => {
  beforeEach(() => {
    mockChange.mockReset();
    mockChange.mockResolvedValue(undefined as never);
  });

  it('renders a read-only badge when no transitions are allowed', () => {
    render(<AppointmentStatusPill appointment={makeAppointment('COMPLETED')} />);
    const pill = screen.getByText('Completed');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass('rounded-full!', 'text-[10px]', 'uppercase');
    expect(pill).toHaveStyle({ backgroundColor: 'var(--color-pill-success-bg)' });
    // No dropdown trigger — it is a static span.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a read-only badge when editing is disabled', () => {
    render(<AppointmentStatusPill appointment={makeAppointment('IN_PROGRESS')} canEdit={false} />);
    expect(screen.getByText('In progress')).toHaveStyle({
      backgroundColor: 'var(--color-pill-progress-bg)',
    });
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
    const onChanged = jest.fn();
    render(
      <AppointmentStatusPill appointment={makeAppointment('IN_PROGRESS')} onChanged={onChanged} />
    );
    fireEvent.click(screen.getByRole('button', { name: /in progress/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Completed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    // A failed change must not look like a success: the menu stays open and no
    // consumer is told the appointment changed.
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
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

describe('getAppointmentStatusTone', () => {
  it('maps appointment statuses to shared inventory-style pill tones', () => {
    expect(getAppointmentStatusTone('COMPLETED')).toBe('success');
    expect(getAppointmentStatusTone('IN_PROGRESS')).toBe('progress');
    expect(getAppointmentStatusTone('CHECKED_IN')).toBe('info');
    expect(getAppointmentStatusTone('Checked in')).toBe('info');
    expect(getAppointmentStatusTone('UPCOMING')).toBe('info');
    expect(getAppointmentStatusTone('CANCELLED')).toBe('danger');
    expect(getAppointmentStatusTone('NO_SHOW')).toBe('danger');
    expect(getAppointmentStatusTone('REQUESTED')).toBe('neutral');
    expect(getAppointmentStatusTone(undefined)).toBe('neutral');
  });
});

/**
 * Regression cover for QA bugs 44 / 36. These drive the pill against the REAL
 * appointmentService so a missing organisation/appointment id travels the full
 * path the user hits. Previously the service returned undefined on those
 * preconditions, so the pill treated a no-op as success: popover closed, no
 * error, status unchanged. Mocking the service cannot catch that — a mock
 * resolving `undefined` is indistinguishable from the bug.
 */
describe('AppointmentStatusPill — real service precondition failures', () => {
  const actualService = jest.requireActual(
    '@/app/features/appointments/services/appointmentService'
  ) as typeof import('@/app/features/appointments/services/appointmentService');

  beforeEach(() => {
    mockChange.mockReset();
    // Route the component's call to the real implementation.
    mockChange.mockImplementation(actualService.changeAppointmentStatus);
    (useAppointmentStore.getState as jest.Mock).mockReturnValue({ upsertAppointment: jest.fn() });
  });

  const openMenuAndPick = (appointment: Appointment, trigger: RegExp, item: string) => {
    const onChanged = jest.fn();
    render(<AppointmentStatusPill appointment={appointment} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: trigger }));
    fireEvent.click(screen.getByRole('menuitem', { name: item }));
    return onChanged;
  };

  const expectSurfacedFailure = async (onChanged: jest.Mock, message: string) => {
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    // The bug: these two were the silent-success tell.
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    expect(patchData).not.toHaveBeenCalled();
  };

  it('surfaces a missing organisation on the update path (IN_PROGRESS -> COMPLETED)', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
    const onChanged = openMenuAndPick(
      makeAppointment('IN_PROGRESS', { organisationId: undefined }),
      /in progress/i,
      'Completed'
    );
    await expectSurfacedFailure(onChanged, 'No organisation selected. Cannot update appointment.');
  });

  it('surfaces a missing appointment id on the update path (IN_PROGRESS -> COMPLETED)', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: 'org-1' });
    const onChanged = openMenuAndPick(
      makeAppointment('IN_PROGRESS', { id: undefined }),
      /in progress/i,
      'Completed'
    );
    await expectSurfacedFailure(onChanged, 'Cannot update appointment: appointment ID missing.');
  });

  it('surfaces a missing organisation on the action path (UPCOMING -> CHECKED_IN)', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
    const onChanged = openMenuAndPick(
      makeAppointment('UPCOMING', { organisationId: undefined }),
      /upcoming/i,
      'Checked in'
    );
    await expectSurfacedFailure(onChanged, 'No organisation selected. Cannot checkin appointment.');
  });

  it('surfaces a missing appointment id on the action path (UPCOMING -> CHECKED_IN)', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: 'org-1' });
    const onChanged = openMenuAndPick(
      makeAppointment('UPCOMING', { id: undefined }),
      /upcoming/i,
      'Checked in'
    );
    await expectSurfacedFailure(onChanged, 'Cannot checkin appointment: appointment ID missing.');
  });
});
