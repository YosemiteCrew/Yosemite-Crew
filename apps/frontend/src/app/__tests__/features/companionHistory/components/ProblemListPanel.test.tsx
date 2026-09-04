import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ProblemListPanel from '@/app/features/companionHistory/components/ProblemListPanel';
import {
  createPatientProblem,
  fetchPatientProblems,
  resolvePatientProblem,
  type PatientProblem,
} from '@/app/features/companionHistory/services/patientProblemService';

const mockNotify = jest.fn();
let mockPermissions: string[] = ['appointments:view:any', 'appointments:edit:any'];

jest.mock('@/app/services/axios', () => ({
  isAuthRedirectError: jest.fn(() => false),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (perm: string) => mockPermissions.includes(perm) }),
}));

jest.mock('@/app/features/companionHistory/services/patientProblemService', () => ({
  fetchPatientProblems: jest.fn(),
  createPatientProblem: jest.fn(),
  resolvePatientProblem: jest.fn(),
}));

const fetchMock = fetchPatientProblems as jest.Mock;
const createMock = createPatientProblem as jest.Mock;
const resolveMock = resolvePatientProblem as jest.Mock;

const problem = (over: Partial<PatientProblem> & { id: string; name: string }): PatientProblem => ({
  organisationId: 'org-1',
  patientId: 'comp-1',
  encounterId: null,
  codeSystem: null,
  code: null,
  status: 'ACTIVE',
  severity: null,
  onsetDate: null,
  resolvedDate: null,
  notes: null,
  recordedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions = ['appointments:view:any', 'appointments:edit:any'];
  fetchMock.mockResolvedValue([]);
});

describe('ProblemListPanel', () => {
  it('loads and renders the patient problems', async () => {
    fetchMock.mockResolvedValue([
      problem({ id: 'p-1', name: 'Chronic kidney disease', severity: 'SEVERE' }),
    ]);

    render(<ProblemListPanel companionId="comp-1" />);

    expect(await screen.findByText('Chronic kidney disease')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith({ patientId: 'comp-1' });
  });

  it('shows the empty state when there are no problems', async () => {
    render(<ProblemListPanel companionId="comp-1" />);
    expect(await screen.findByText(/No problems recorded/)).toBeInTheDocument();
  });

  it('shows an error banner when the load fails', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    render(<ProblemListPanel companionId="comp-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the problem list');
  });

  it('creates a problem, converting the onset date to an ISO datetime', async () => {
    createMock.mockResolvedValue(
      problem({ id: 'p-new', name: 'New skin lesion', severity: 'MODERATE' })
    );
    render(<ProblemListPanel companionId="comp-1" />);
    await screen.findByText(/No problems recorded/);

    await userEvent.click(screen.getByRole('button', { name: /Add problem/ }));
    await userEvent.type(screen.getByLabelText('Problem title'), 'New skin lesion');
    await userEvent.type(screen.getByLabelText('Description'), 'left flank');
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'MODERATE');
    fireEvent.change(screen.getByLabelText('Onset date'), { target: { value: '2026-02-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save problem' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        patientId: 'comp-1',
        name: 'New skin lesion',
        notes: 'left flank',
        severity: 'MODERATE',
        onsetDate: '2026-02-01T00:00:00.000Z',
      })
    );
    expect(await screen.findByText('New skin lesion')).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Problem added' })
    );
  });

  it('notifies on a failed create', async () => {
    createMock.mockRejectedValue(new Error('nope'));
    render(<ProblemListPanel companionId="comp-1" />);
    await screen.findByText(/No problems recorded/);

    await userEvent.click(screen.getByRole('button', { name: /Add problem/ }));
    await userEvent.type(screen.getByLabelText('Problem title'), 'Retry me');
    await userEvent.click(screen.getByRole('button', { name: 'Save problem' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not add problem' })
      )
    );
    // Form stays open after a failed save.
    expect(screen.getByLabelText('Problem title')).toBeInTheDocument();
  });

  it('resolves an active problem and updates its status', async () => {
    fetchMock.mockResolvedValue([problem({ id: 'p-1', name: 'Otitis externa', status: 'ACTIVE' })]);
    resolveMock.mockResolvedValue(
      problem({
        id: 'p-1',
        name: 'Otitis externa',
        status: 'RESOLVED',
        resolvedDate: '2026-02-02T00:00:00.000Z',
      })
    );
    render(<ProblemListPanel companionId="comp-1" />);
    await screen.findByText('Otitis externa');

    await userEvent.click(screen.getByRole('button', { name: 'Resolve Otitis externa' }));

    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith('p-1'));
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Problem resolved' })
    );
  });

  it('renders nothing when the member cannot view problems', () => {
    mockPermissions = [];
    const { container } = render(<ProblemListPanel companionId="comp-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides the edit controls when the member can view but not edit', async () => {
    mockPermissions = ['appointments:view:any'];
    fetchMock.mockResolvedValue([problem({ id: 'p-1', name: 'Chronic kidney disease' })]);
    render(<ProblemListPanel companionId="comp-1" />);

    await screen.findByText('Chronic kidney disease');
    expect(screen.queryByRole('button', { name: /Add problem/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resolve / })).not.toBeInTheDocument();
  });
});
