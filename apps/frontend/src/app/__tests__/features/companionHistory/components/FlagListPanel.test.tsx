import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { isAuthRedirectError } from '@/app/services/axios';
import FlagListPanel from '@/app/features/companionHistory/components/FlagListPanel';
import {
  createPatientFlag,
  fetchPatientFlags,
  resolvePatientFlag,
  type PatientFlag,
} from '@/app/features/companionHistory/services/patientFlagService';

const notifyMock = jest.fn();
let permissionsMock: string[] = ['companions:view:any', 'companions:edit:any'];

jest.mock('@/app/services/axios', () => ({
  isAuthRedirectError: jest.fn(() => false),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (permission: string) => permissionsMock.includes(permission) }),
}));

jest.mock('@/app/features/companionHistory/services/patientFlagService', () => ({
  createPatientFlag: jest.fn(),
  fetchPatientFlags: jest.fn(),
  resolvePatientFlag: jest.fn(),
}));

const createMock = createPatientFlag as jest.Mock;
const fetchMock = fetchPatientFlags as jest.Mock;
const resolveMock = resolvePatientFlag as jest.Mock;
const isAuthRedirectMock = isAuthRedirectError as jest.Mock;

const flag = (overrides: Partial<PatientFlag> & { id: string; title: string }): PatientFlag => ({
  organisationId: 'org-1',
  patientId: 'patient-1',
  flagType: 'SPECIAL_HANDLING',
  severity: 'MEDIUM',
  description: null,
  isActive: true,
  createdBy: null,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  permissionsMock = ['companions:view:any', 'companions:edit:any'];
  fetchMock.mockResolvedValue([]);
});

describe('FlagListPanel', () => {
  it('loads only active flags for the patient', async () => {
    fetchMock.mockResolvedValue([flag({ id: 'flag-1', title: 'Use a muzzle' })]);

    render(<FlagListPanel companionId="patient-1" />);

    expect(await screen.findByText('Use a muzzle')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith({ patientId: 'patient-1', isActive: true });
  });

  it('shows the empty state when no active flags exist', async () => {
    render(<FlagListPanel companionId="patient-1" />);
    expect(await screen.findByText('No active flags for this patient.')).toBeInTheDocument();
  });

  it.each([new Error('load failed'), new Error('No active organisation selected.')])(
    'shows a load error when the service rejects with %s',
    async (error) => {
      fetchMock.mockRejectedValue(error);
      render(<FlagListPanel companionId="patient-1" />);
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not load patient flags');
    }
  );

  it('creates a flag and refetches the active list', async () => {
    const created = flag({ id: 'flag-new', title: 'Use side entrance', flagType: 'ESCAPE_RISK' });
    fetchMock.mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
    createMock.mockResolvedValue(created);
    render(<FlagListPanel companionId="patient-1" />);
    await screen.findByText('No active flags for this patient.');

    await userEvent.click(screen.getByRole('button', { name: 'Add flag' }));
    await userEvent.type(screen.getByLabelText('Flag title'), 'Use side entrance');
    await userEvent.selectOptions(screen.getByLabelText('Flag type'), 'ESCAPE_RISK');
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'HIGH');
    await userEvent.type(screen.getByLabelText('Description'), '  Keep both doors closed  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save flag' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        patientId: 'patient-1',
        title: 'Use side entrance',
        flagType: 'ESCAPE_RISK',
        severity: 'HIGH',
        description: 'Keep both doors closed',
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Use side entrance')).toBeInTheDocument();
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Flag added' })
    );
  });

  it('omits an empty description when creating', async () => {
    fetchMock.mockResolvedValue([]);
    createMock.mockResolvedValue(flag({ id: 'flag-new', title: 'Priority patient' }));
    render(<FlagListPanel companionId="patient-1" />);
    await screen.findByText('No active flags for this patient.');

    await userEvent.click(screen.getByRole('button', { name: 'Add flag' }));
    await userEvent.type(screen.getByLabelText('Flag title'), 'Priority patient');
    await userEvent.click(screen.getByRole('button', { name: 'Save flag' }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0]).not.toHaveProperty('description');
  });

  it('keeps the form open and notifies when create fails', async () => {
    createMock.mockRejectedValue(new Error('failed'));
    render(<FlagListPanel companionId="patient-1" />);
    await screen.findByText('No active flags for this patient.');

    await userEvent.click(screen.getByRole('button', { name: 'Add flag' }));
    await userEvent.type(screen.getByLabelText('Flag title'), 'Retry me');
    await userEvent.click(screen.getByRole('button', { name: 'Save flag' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not add flag' })
      )
    );
    expect(screen.getByLabelText('Flag title')).toBeInTheDocument();
  });

  it('stays silent when create triggers an auth redirect', async () => {
    createMock.mockRejectedValue(new Error('redirect'));
    isAuthRedirectMock.mockReturnValueOnce(true);
    render(<FlagListPanel companionId="patient-1" />);
    await screen.findByText('No active flags for this patient.');

    await userEvent.click(screen.getByRole('button', { name: 'Add flag' }));
    await userEvent.type(screen.getByLabelText('Flag title'), 'Do not save');
    await userEvent.click(screen.getByRole('button', { name: 'Save flag' }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(notifyMock).not.toHaveBeenCalledWith('error', expect.anything());
  });

  it('resolves a flag and removes it from the active list', async () => {
    const activeFlag = flag({ id: 'flag-1', title: 'Use a muzzle' });
    fetchMock.mockResolvedValue([activeFlag]);
    resolveMock.mockResolvedValue({ ...activeFlag, isActive: false });
    render(<FlagListPanel companionId="patient-1" />);
    await screen.findByText('Use a muzzle');

    await userEvent.click(screen.getByRole('button', { name: 'Resolve Use a muzzle' }));

    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith('flag-1'));
    expect(screen.queryByText('Use a muzzle')).not.toBeInTheDocument();
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Flag resolved' })
    );
  });

  it('notifies and keeps the flag active when resolve fails', async () => {
    fetchMock.mockResolvedValue([flag({ id: 'flag-1', title: 'Use a muzzle' })]);
    resolveMock.mockRejectedValue(new Error('failed'));
    render(<FlagListPanel companionId="patient-1" />);
    await screen.findByText('Use a muzzle');

    await userEvent.click(screen.getByRole('button', { name: 'Resolve Use a muzzle' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not resolve flag' })
      )
    );
    expect(screen.getByRole('button', { name: 'Resolve Use a muzzle' })).toBeInTheDocument();
  });

  it('resets and reloads when the companion changes', async () => {
    fetchMock
      .mockResolvedValueOnce([flag({ id: 'flag-1', title: 'Use a muzzle' })])
      .mockResolvedValueOnce([flag({ id: 'flag-2', title: 'Keep doors closed' })]);
    const { rerender } = render(<FlagListPanel companionId="patient-1" />);
    await screen.findByText('Use a muzzle');

    rerender(<FlagListPanel companionId="patient-2" />);

    expect(await screen.findByText('Keep doors closed')).toBeInTheDocument();
    expect(screen.queryByText('Use a muzzle')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith({ patientId: 'patient-2', isActive: true });
  });

  it('renders nothing without view permission', () => {
    permissionsMock = [];
    const { container } = render(<FlagListPanel companionId="patient-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides write controls without edit permission', async () => {
    permissionsMock = ['companions:view:any'];
    fetchMock.mockResolvedValue([flag({ id: 'flag-1', title: 'Use a muzzle' })]);
    render(<FlagListPanel companionId="patient-1" />);

    await screen.findByText('Use a muzzle');
    expect(screen.queryByRole('button', { name: 'Add flag' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resolve / })).not.toBeInTheDocument();
  });
});
