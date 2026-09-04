import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ProblemList from '@/app/features/companionHistory/components/ProblemList';
import type { PatientProblem } from '@/app/features/companionHistory/services/patientProblemService';

const problem = (over: Partial<PatientProblem> & { id: string; name: string }): PatientProblem => ({
  organisationId: 'org-1',
  patientId: 'pat-1',
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

const PROBLEMS: PatientProblem[] = [
  problem({
    id: 'p-1',
    name: 'Chronic kidney disease',
    status: 'ACTIVE',
    severity: 'SEVERE',
    onsetDate: '2025-11-02T00:00:00.000Z',
    notes: 'IRIS stage 3.',
  }),
  problem({
    id: 'p-2',
    name: 'Mild dental tartar',
    status: 'ACTIVE',
    severity: 'MILD',
  }),
  problem({
    id: 'p-3',
    name: 'Post-operative wound',
    status: 'RESOLVED',
    severity: 'MODERATE',
    resolvedDate: '2025-08-20T00:00:00.000Z',
  }),
];

describe('ProblemList', () => {
  it('renders active and resolved problems with status and severity pills', () => {
    render(<ProblemList problems={PROBLEMS} canEdit />);

    expect(screen.getByText('Chronic kidney disease')).toBeInTheDocument();
    expect(screen.getByText('Post-operative wound')).toBeInTheDocument();

    // Status pills: two active, one resolved.
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Resolved')).toBeInTheDocument();

    // Severity pills mapped to plain-language labels.
    expect(screen.getByText('Severe')).toBeInTheDocument();
    expect(screen.getByText('Mild')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();

    // Active count summary.
    expect(screen.getByText('2 active')).toBeInTheDocument();

    // Onset + resolved metadata rendered (locale-agnostic: the formatted date
    // ends with the year, and the "not recorded" row would not).
    expect(screen.getByText(/^Onset\b.*2025$/)).toBeInTheDocument();
    expect(screen.getByText(/^Resolved\b.*2025$/)).toBeInTheDocument();
  });

  it('shows a resolve action only for active problems and fires onResolve', async () => {
    const onResolve = jest.fn();
    render(<ProblemList problems={PROBLEMS} canEdit onResolve={onResolve} />);

    const resolveButtons = screen.getAllByRole('button', { name: /^Resolve / });
    // Only the two ACTIVE problems get a resolve control, not the RESOLVED one.
    expect(resolveButtons).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Resolve Chronic kidney disease' }));
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1' }));
  });

  it('opens the add form and submits collected values, then closes on success', async () => {
    const onCreate = jest.fn().mockResolvedValue(true);
    render(<ProblemList problems={PROBLEMS} canEdit onCreate={onCreate} />);

    // Form is hidden until the affordance is used.
    expect(screen.queryByLabelText('Problem title')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Add problem/ }));

    const nameInput = screen.getByLabelText('Problem title');
    expect(nameInput).toBeInTheDocument();

    await userEvent.type(nameInput, 'New skin lesion');
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'MODERATE');
    fireEvent.change(screen.getByLabelText('Onset date'), { target: { value: '2026-02-01' } });

    await userEvent.click(screen.getByRole('button', { name: 'Save problem' }));

    expect(onCreate).toHaveBeenCalledWith({
      name: 'New skin lesion',
      notes: '',
      severity: 'MODERATE',
      onsetDate: '2026-02-01',
    });

    // A resolved create clears and closes the form.
    await waitFor(() => expect(screen.queryByLabelText('Problem title')).not.toBeInTheDocument());
  });

  it('keeps the form open when the create fails', async () => {
    const onCreate = jest.fn().mockResolvedValue(false);
    render(<ProblemList problems={[]} canEdit onCreate={onCreate} />);

    await userEvent.click(screen.getByRole('button', { name: /Add problem/ }));
    await userEvent.type(screen.getByLabelText('Problem title'), 'Retry me');
    await userEvent.click(screen.getByRole('button', { name: 'Save problem' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Problem title')).toBeInTheDocument();
  });

  it('renders the empty state when there are no problems', () => {
    render(<ProblemList problems={[]} canEdit />);
    expect(screen.getByText(/No problems recorded/)).toBeInTheDocument();
    expect(screen.queryByText('2 active')).not.toBeInTheDocument();
  });

  it('renders a loading skeleton instead of the empty copy', () => {
    render(<ProblemList problems={[]} loading canEdit />);
    expect(screen.queryByText(/No problems recorded/)).not.toBeInTheDocument();
  });

  it('surfaces an error banner', () => {
    render(
      <ProblemList problems={[]} error="Could not load the problem list. Please try again." />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the problem list');
  });

  it('hides the add and resolve controls when the member cannot edit', () => {
    render(<ProblemList problems={PROBLEMS} canEdit={false} />);
    expect(screen.queryByRole('button', { name: /Add problem/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resolve / })).not.toBeInTheDocument();
  });
});
