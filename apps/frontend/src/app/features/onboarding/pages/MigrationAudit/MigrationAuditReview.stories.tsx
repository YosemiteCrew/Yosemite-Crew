import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import MigrationAuditReview from './MigrationAuditReview';
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

const COMPLETED_RUN: MigrationAuditRun = {
  ...BASE_RUN,
  status: 'COMPLETED',
  completedAt: '2026-09-12T00:00:05.000Z',
  summary: {
    OWNERS: { status: 'ASSESSED', totalRows: 42, duplicateIdentifiers: 1, orphanReferences: 0 },
    ANIMALS: { status: 'ASSESSED', totalRows: 58, duplicateIdentifiers: 0, orphanReferences: 2 },
    APPOINTMENTS: {
      status: 'ASSESSED',
      totalRows: 130,
      duplicateIdentifiers: 0,
      orphanReferences: 0,
    },
    ATTACHMENTS: {
      status: 'NOT_ASSESSED',
      notAssessedReason: 'file_not_provided',
      totalRows: 0,
      duplicateIdentifiers: 0,
      orphanReferences: 0,
    },
  },
  outcome: {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: 'orphan_reference',
        diagnostics: 'animals.csv row 12 references owner_external_id not present in owners.csv.',
        expression: ['animals.csv[row 12]'],
      },
      {
        severity: 'warning',
        code: 'duplicate_identifier',
        diagnostics: 'owners.csv row 30 repeats external_id already seen at row 4.',
        expression: ['owners.csv[row 30]'],
      },
      {
        severity: 'information',
        code: 'attachment_manifest_not_provided',
        diagnostics: 'No attachment manifest was provided; attachments were not assessed.',
        expression: ['attachments.csv'],
      },
    ],
  },
};

const meta = {
  title: 'Onboarding/MigrationAuditReview',
  component: MigrationAuditReview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Renders one migration-audit run (#3056's read-only API): in-flight while " +
          'PENDING/RUNNING, the failure reason on FAILED, and on COMPLETED the per-section ' +
          'summary plus every finding grouped by source file and severity.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    run: BASE_RUN,
    onStartNew: fn(),
  },
} satisfies Meta<typeof MigrationAuditReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {
  name: 'PENDING/RUNNING - no restart action yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent(/Reading the uploaded files/);
    await expect(
      canvas.queryByRole('button', { name: 'Start a new audit' })
    ).not.toBeInTheDocument();
  },
};

export const Failed: Story = {
  name: 'Run failed - shows the reason and offers a restart',
  args: {
    run: { ...BASE_RUN, status: 'FAILED', errorMessage: 'owners.csv could not be parsed as CSV.' },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'owners.csv could not be parsed as CSV.'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Start a new audit' }));
    await expect(args.onStartNew).toHaveBeenCalled();
  },
};

export const Completed: Story = {
  name: 'Completed - per-section summary and grouped findings',
  args: { run: COMPLETED_RUN },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Findings (3)')).toBeInTheDocument();
    await expect(canvas.getByText('Not assessed (file_not_provided).')).toBeInTheDocument();
    await expect(canvas.getByText('Row 12')).toBeInTheDocument();
    await expect(canvas.getByText('information')).toBeInTheDocument();
  },
};

export const CompletedNoFindings: Story = {
  name: 'Completed - no findings',
  args: {
    run: {
      ...COMPLETED_RUN,
      outcome: { resourceType: 'OperationOutcome', issue: [] },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Findings (0)')).toBeInTheDocument();
    await expect(canvas.getByText(/No findings/)).toBeInTheDocument();
  },
};
