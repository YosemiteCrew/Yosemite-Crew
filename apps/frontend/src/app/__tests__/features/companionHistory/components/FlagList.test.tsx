import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import FlagList from '@/app/features/companionHistory/components/FlagList';
import type { PatientFlag } from '@/app/features/companionHistory/services/patientFlagService';

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

const FLAGS: PatientFlag[] = [
  flag({
    id: 'flag-1',
    title: 'Use a muzzle',
    flagType: 'AGGRESSION',
    severity: 'CRITICAL',
    description: 'Approach slowly and keep away from other dogs.',
  }),
  flag({
    id: 'flag-2',
    title: 'Keep doors closed',
    flagType: 'ESCAPE_RISK',
    severity: 'HIGH',
  }),
  flag({
    id: 'flag-3',
    title: 'Isolation complete',
    flagType: 'QUARANTINE',
    severity: 'LOW',
    isActive: false,
    resolvedAt: '2026-02-02T00:00:00.000Z',
  }),
];

describe('FlagList', () => {
  it('renders flag labels, severity, status, description, and active count', () => {
    render(<FlagList flags={FLAGS} canEdit />);

    expect(screen.getByText('Use a muzzle')).toBeInTheDocument();
    expect(screen.getByText('Aggression risk')).toBeInTheDocument();
    expect(screen.getByText(/Approach slowly/)).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
    expect(screen.getByText(/^Resolved\b.*2026$/)).toBeInTheDocument();
  });

  it('resolves only active flags', async () => {
    const onResolve = jest.fn();
    render(<FlagList flags={FLAGS} canEdit onResolve={onResolve} />);

    expect(screen.getAllByRole('button', { name: /^Resolve / })).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Resolve Use a muzzle' }));
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ id: 'flag-1' }));
  });

  it('submits the create form and closes it after a successful save', async () => {
    const onCreate = jest.fn().mockResolvedValue(true);
    render(<FlagList flags={[]} canEdit onCreate={onCreate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add flag' }));
    await userEvent.type(screen.getByLabelText('Flag title'), '  Needs quiet room  ');
    await userEvent.selectOptions(screen.getByLabelText('Flag type'), 'ANXIETY');
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'HIGH');
    await userEvent.type(screen.getByLabelText('Description'), 'Dim the lights');
    await userEvent.click(screen.getByRole('button', { name: 'Save flag' }));

    expect(onCreate).toHaveBeenCalledWith({
      title: 'Needs quiet room',
      flagType: 'ANXIETY',
      severity: 'HIGH',
      description: 'Dim the lights',
    });
    await waitFor(() => expect(screen.queryByLabelText('Flag title')).not.toBeInTheDocument());
  });

  it('keeps the form open after a failed save', async () => {
    const onCreate = jest.fn().mockResolvedValue(false);
    render(<FlagList flags={[]} canEdit onCreate={onCreate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add flag' }));
    await userEvent.type(screen.getByLabelText('Flag title'), 'Retry me');
    await userEvent.click(screen.getByRole('button', { name: 'Save flag' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Flag title')).toBeInTheDocument();
  });

  it('closes the create form when cancel is selected', async () => {
    render(<FlagList flags={[]} canEdit />);

    await userEvent.click(screen.getByRole('button', { name: 'Add flag' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Flag title')).not.toBeInTheDocument();
  });

  it('renders the empty, loading, and error states', () => {
    const { rerender } = render(<FlagList flags={[]} />);
    expect(screen.getByText('No active flags for this patient.')).toBeInTheDocument();

    rerender(<FlagList flags={[]} loading />);
    expect(screen.queryByText('No active flags for this patient.')).not.toBeInTheDocument();

    rerender(<FlagList flags={[]} error="Could not load patient flags." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load patient flags.');
  });

  it('hides edit controls when the member cannot edit', () => {
    render(<FlagList flags={FLAGS} canEdit={false} />);

    expect(screen.queryByRole('button', { name: 'Add flag' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resolve / })).not.toBeInTheDocument();
  });

  it('handles a resolved flag with an invalid timestamp', () => {
    render(
      <FlagList
        flags={[
          flag({ id: 'flag-invalid', title: 'Old note', isActive: false, resolvedAt: 'invalid' }),
        ]}
      />
    );

    expect(screen.getByText('Old note')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.queryByText(/^Resolved\b.*\d{4}$/)).not.toBeInTheDocument();
  });
});
