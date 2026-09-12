import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

import MigrationAuditReview from '@/app/features/onboarding/pages/MigrationAudit/MigrationAuditReview';
import type { MigrationAuditRun } from '@/app/features/onboarding/services/migrationAuditService';

const BASE_RUN: MigrationAuditRun = {
  id: 'run1',
  status: 'PENDING',
  summary: null,
  errorMessage: null,
  createdAt: '2026-09-12T00:00:00.000Z',
  completedAt: null,
  outcome: { resourceType: 'OperationOutcome', issue: [] },
};

describe('MigrationAuditReview', () => {
  it('announces progress while PENDING, with no restart action', () => {
    render(<MigrationAuditReview run={BASE_RUN} onStartNew={jest.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Reading the uploaded files/);
    expect(screen.queryByRole('button', { name: 'Start a new audit' })).not.toBeInTheDocument();
  });

  it('announces progress while RUNNING too', () => {
    render(<MigrationAuditReview run={{ ...BASE_RUN, status: 'RUNNING' }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the failure reason and offers a restart, falling back to a generic message when none is given', async () => {
    const user = userEvent.setup();
    const onStartNew = jest.fn();
    render(
      <MigrationAuditReview
        run={{ ...BASE_RUN, status: 'FAILED', errorMessage: null }}
        onStartNew={onStartNew}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be completed/);

    await user.click(screen.getByRole('button', { name: 'Start a new audit' }));
    expect(onStartNew).toHaveBeenCalled();
  });

  it('shows a not-assessed section with its reason, and an empty findings state', () => {
    render(
      <MigrationAuditReview
        run={{
          ...BASE_RUN,
          status: 'COMPLETED',
          summary: {
            OWNERS: {
              status: 'NOT_ASSESSED',
              notAssessedReason: 'file_not_provided',
              totalRows: 0,
              duplicateIdentifiers: 0,
              orphanReferences: 0,
            },
          },
        }}
      />
    );
    expect(screen.getByText('Not assessed (file_not_provided).')).toBeInTheDocument();
    expect(screen.getByText('Findings (0)')).toBeInTheDocument();
    expect(screen.getByText(/No findings/)).toBeInTheDocument();
  });

  it('groups findings by source file in section order and by severity within a group, including an unrecognised file and a fatal severity', () => {
    render(
      <MigrationAuditReview
        run={{
          ...BASE_RUN,
          status: 'COMPLETED',
          summary: {
            OWNERS: {
              status: 'ASSESSED',
              totalRows: 3,
              duplicateIdentifiers: 1,
              orphanReferences: 0,
            },
          },
          outcome: {
            resourceType: 'OperationOutcome',
            issue: [
              {
                severity: 'warning',
                code: 'duplicate_identifier',
                diagnostics: 'owners.csv row 2 repeats external_id already seen at row 1.',
                expression: ['owners.csv[row 2]'],
              },
              {
                severity: 'fatal',
                code: 'missing_file',
                diagnostics: 'appointments.csv was not provided.',
                expression: ['appointments.csv'],
              },
              {
                severity: 'information',
                code: 'unsupported_column',
                diagnostics: 'notes.csv has column(s) outside the supported set: extra.',
                expression: ['notes.csv'],
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByText('Findings (3)')).toBeInTheDocument();
    const groupTitles = screen
      .getAllByText(/\.csv$/, { selector: 'h3' })
      .map((el) => el.textContent);
    // owners.csv (order 0) and appointments.csv (order 2) sort ahead of the
    // unrecognised notes.csv, which falls back to the end of the order.
    expect(groupTitles).toEqual(['owners.csv', 'appointments.csv', 'notes.csv']);

    expect(screen.getByText('Row 2')).toBeInTheDocument();
    expect(screen.getByText('fatal')).toBeInTheDocument();
    expect(screen.getByText('information')).toBeInTheDocument();
  });
});
