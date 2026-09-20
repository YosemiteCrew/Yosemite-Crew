import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/features/onboarding/services/migrationAuditService', () => ({
  getMigrationAuditUploadUrl: jest.fn(),
  uploadMigrationAuditFile: jest.fn(),
  createMigrationAuditRun: jest.fn(),
  getMigrationAuditRun: jest.fn(),
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import MigrationAudit, {
  POLL_INTERVAL_MS,
} from '@/app/features/onboarding/pages/MigrationAudit/MigrationAudit';
import {
  createMigrationAuditRun,
  getMigrationAuditRun,
  getMigrationAuditUploadUrl,
  uploadMigrationAuditFile,
} from '@/app/features/onboarding/services/migrationAuditService';
import { useOrgStore } from '@/app/stores/orgStore';
import { logger } from '@/app/lib/logger';

const loggerErrorMock = logger.error as jest.Mock;

const getUploadUrlMock = getMigrationAuditUploadUrl as jest.Mock;
const uploadFileMock = uploadMigrationAuditFile as jest.Mock;
const createRunMock = createMigrationAuditRun as jest.Mock;
const getRunMock = getMigrationAuditRun as jest.Mock;

const csvFile = (name: string) => new File(['external_id\n1'], name, { type: 'text/csv' });

const selectRequiredFiles = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.upload(screen.getByLabelText('Owners'), csvFile('owners.csv'));
  await user.upload(screen.getByLabelText('Animals'), csvFile('animals.csv'));
  await user.upload(screen.getByLabelText('Appointments'), csvFile('appointments.csv'));
};

const COMPLETED_RUN = {
  id: 'run1',
  status: 'COMPLETED' as const,
  summary: {
    OWNERS: {
      status: 'ASSESSED' as const,
      totalRows: 2,
      duplicateIdentifiers: 0,
      orphanReferences: 0,
    },
    ANIMALS: {
      status: 'ASSESSED' as const,
      totalRows: 1,
      duplicateIdentifiers: 0,
      orphanReferences: 1,
    },
  },
  errorMessage: null,
  createdAt: '2026-09-12T00:00:00.000Z',
  completedAt: '2026-09-12T00:00:05.000Z',
  outcome: {
    resourceType: 'OperationOutcome' as const,
    issue: [
      {
        severity: 'error',
        code: 'orphan_reference',
        diagnostics: 'animals.csv row 1 references owner_external_id not present in owners.csv.',
        expression: ['animals.csv[row 1]'],
      },
    ],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  useOrgStore.setState({ primaryOrgId: 'org1' });
  getUploadUrlMock.mockResolvedValue({ url: 'https://s3.example/put', key: 'orgs/org1/x.csv' });
  uploadFileMock.mockResolvedValue(undefined);
});

describe('MigrationAudit page', () => {
  it('disables submit until every required file is chosen', async () => {
    const user = userEvent.setup();
    render(<MigrationAudit />);

    expect(screen.getByRole('button', { name: 'Run migration audit' })).toBeDisabled();

    await selectRequiredFiles(user);
    expect(screen.getByRole('button', { name: 'Run migration audit' })).toBeEnabled();
  });

  it('re-disables submit when a required file is cleared after being chosen', async () => {
    const user = userEvent.setup();
    render(<MigrationAudit />);

    await selectRequiredFiles(user);
    expect(screen.getByRole('button', { name: 'Run migration audit' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Owners'), { target: { files: [] } });
    expect(screen.getByRole('button', { name: 'Run migration audit' })).toBeDisabled();
  });

  it(
    'uploads each required file, creates the run, and polls to completion',
    async () => {
      const user = userEvent.setup();
      createRunMock.mockResolvedValue({ id: 'run1', status: 'PENDING' });
      getRunMock.mockResolvedValue(COMPLETED_RUN);

      render(<MigrationAudit />);
      await selectRequiredFiles(user);
      await user.click(screen.getByRole('button', { name: 'Run migration audit' }));

      expect(getUploadUrlMock).toHaveBeenCalledTimes(3);
      expect(uploadFileMock).toHaveBeenCalledTimes(3);
      expect(createRunMock).toHaveBeenCalledWith('org1', {
        owners: 'orgs/org1/x.csv',
        animals: 'orgs/org1/x.csv',
        appointments: 'orgs/org1/x.csv',
      });
      expect(screen.getByText(/Reading the uploaded files/)).toBeInTheDocument();

      // The container polls on a real POLL_INTERVAL_MS timer, so this waits
      // for the real interval to fire rather than faking it - simpler and
      // less brittle than reconciling fake timers with the awaited upload
      // chain that precedes it.
      await waitFor(() => expect(getRunMock).toHaveBeenCalledWith('org1', 'run1'), {
        timeout: POLL_INTERVAL_MS + 2000,
      });
      expect(await screen.findByText('Findings (1)')).toBeInTheDocument();
      expect(
        screen.getByText(/references owner_external_id not present in owners.csv/)
      ).toBeInTheDocument();
    },
    POLL_INTERVAL_MS + 5000
  );

  it(
    'logs and retries a transient poll failure instead of surfacing it as an error',
    async () => {
      const user = userEvent.setup();
      createRunMock.mockResolvedValue({ id: 'run1', status: 'PENDING' });
      getRunMock.mockRejectedValueOnce(new Error('network blip')).mockResolvedValue(COMPLETED_RUN);

      render(<MigrationAudit />);
      await selectRequiredFiles(user);
      await user.click(screen.getByRole('button', { name: 'Run migration audit' }));

      await waitFor(
        () =>
          expect(loggerErrorMock).toHaveBeenCalledWith(
            'Failed to poll migration audit run',
            expect.any(Error)
          ),
        { timeout: POLL_INTERVAL_MS + 2000 }
      );
      expect(
        screen.queryByText('Could not start the migration audit. Please try again.')
      ).not.toBeInTheDocument();

      expect(
        await screen.findByText('Findings (1)', {}, { timeout: POLL_INTERVAL_MS + 2000 })
      ).toBeInTheDocument();
    },
    2 * POLL_INTERVAL_MS + 5000
  );

  it(
    'shows the failure reason and lets the operator start a new audit',
    async () => {
      const user = userEvent.setup();
      createRunMock.mockResolvedValue({ id: 'run1', status: 'PENDING' });
      getRunMock.mockResolvedValue({
        id: 'run1',
        status: 'FAILED',
        summary: null,
        errorMessage: 'owners.csv could not be parsed as CSV.',
        createdAt: '2026-09-12T00:00:00.000Z',
        completedAt: '2026-09-12T00:00:05.000Z',
        outcome: { resourceType: 'OperationOutcome', issue: [] },
      });

      render(<MigrationAudit />);
      await selectRequiredFiles(user);
      await user.click(screen.getByRole('button', { name: 'Run migration audit' }));

      expect(
        await screen.findByText(
          'owners.csv could not be parsed as CSV.',
          {},
          { timeout: POLL_INTERVAL_MS + 2000 }
        )
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Start a new audit' }));
      expect(screen.getByRole('button', { name: 'Run migration audit' })).toBeInTheDocument();
    },
    POLL_INTERVAL_MS + 5000
  );

  it(
    "drops the previous organisation's completed report when the active organisation changes",
    async () => {
      const user = userEvent.setup();
      createRunMock.mockResolvedValue({ id: 'run1', status: 'PENDING' });
      getRunMock.mockResolvedValue(COMPLETED_RUN);

      render(<MigrationAudit />);
      await selectRequiredFiles(user);
      await user.click(screen.getByRole('button', { name: 'Run migration audit' }));
      expect(
        await screen.findByText('Findings (1)', {}, { timeout: POLL_INTERVAL_MS + 2000 })
      ).toBeInTheDocument();

      await act(async () => {
        useOrgStore.setState({ primaryOrgId: 'org2' });
      });

      expect(screen.queryByText('Findings (1)')).not.toBeInTheDocument();
      // The chosen files went with it, so org2 starts from an empty form.
      expect(screen.getByRole('button', { name: 'Run migration audit' })).toBeDisabled();

      // And it is gone for good - switching back does not resurrect it.
      await act(async () => {
        useOrgStore.setState({ primaryOrgId: 'org1' });
      });
      expect(screen.queryByText('Findings (1)')).not.toBeInTheDocument();
    },
    2 * POLL_INTERVAL_MS + 5000
  );

  it(
    "stops polling the previous organisation's run when the active organisation changes",
    async () => {
      const user = userEvent.setup();
      createRunMock.mockResolvedValue({ id: 'run1', status: 'PENDING' });
      getRunMock.mockResolvedValue({ ...COMPLETED_RUN, status: 'RUNNING', completedAt: null });

      render(<MigrationAudit />);
      await selectRequiredFiles(user);
      await user.click(screen.getByRole('button', { name: 'Run migration audit' }));
      await waitFor(() => expect(getRunMock).toHaveBeenCalledWith('org1', 'run1'), {
        timeout: POLL_INTERVAL_MS + 2000,
      });

      await act(async () => {
        useOrgStore.setState({ primaryOrgId: 'org2' });
      });
      getRunMock.mockClear();

      expect(screen.queryByText(/Reading the uploaded files/)).not.toBeInTheDocument();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2 * POLL_INTERVAL_MS));
      });
      expect(getRunMock).not.toHaveBeenCalled();
    },
    4 * POLL_INTERVAL_MS + 5000
  );

  it('shows an error banner when the upload fails', async () => {
    const user = userEvent.setup();
    getUploadUrlMock.mockRejectedValue(new Error('boom'));

    render(<MigrationAudit />);
    await selectRequiredFiles(user);
    await user.click(screen.getByRole('button', { name: 'Run migration audit' }));

    expect(
      await screen.findByText('Could not start the migration audit. Please try again.')
    ).toBeInTheDocument();
    expect(createRunMock).not.toHaveBeenCalled();
  });
});
