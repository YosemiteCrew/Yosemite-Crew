import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import DraftImportReview from './DraftImportReview';
import type { DraftImportView } from '@/app/services/formDraftImportService';
import './DeveloperFormDraftImport.css';

const BASE_VIEW: DraftImportView = {
  id: 'd1',
  organisationId: 'org1',
  sourceFormId: 'form-consent',
  draftFormId: 'draft-form-1',
  suppliedText:
    'Patient name | input | required\nConsent to treatment | boolean | required\n' +
    'Signature | inkblot',
  fields: [
    {
      id: 'patient-name',
      type: 'input',
      label: 'Patient name',
      required: true,
      sourceLine: 1,
    },
    {
      id: 'consent-to-treatment',
      type: 'boolean',
      label: 'Consent to treatment',
      required: true,
      sourceLine: 2,
    },
  ],
  unsupportedConstructs: [
    { line: 3, raw: 'Signature | inkblot', reason: 'Unknown field type "inkblot"' },
  ],
  diff: [
    {
      id: 'patient-name',
      change: 'added',
      after: { type: 'input', label: 'Patient name', required: true },
    },
    {
      id: 'consent-to-treatment',
      change: 'changed',
      before: { type: 'boolean', label: 'Consent to treatment', required: false },
      after: { type: 'boolean', label: 'Consent to treatment', required: true },
    },
    {
      id: 'legacy-notes',
      change: 'removed',
      before: { type: 'textarea', label: 'Legacy notes', required: false },
    },
  ],
  stale: false,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

const meta = {
  title: 'Developers/DraftImportReview',
  component: DraftImportReview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders one completed draft import: proposed fields, every unsupported construct ' +
          '(shown with its source line and reason, never silently dropped), and the diff against ' +
          "the source form's latest published version. Owns no server state.",
      },
    },
  },
  tags: ['autodocs'],
  args: {
    view: BASE_VIEW,
    refreshing: false,
    discarding: false,
    onRefresh: fn(),
    onDiscard: fn(),
  },
} satisfies Meta<typeof DraftImportReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Fields, unsupported construct, and a mixed diff',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Proposed fields (2)')).toBeInTheDocument();
    await expect(canvas.getByText('Unsupported constructs (1)')).toBeInTheDocument();
    await expect(canvas.getByText('Signature | inkblot')).toBeInTheDocument();
    await expect(canvas.getByTestId('diff-patient-name')).toHaveTextContent('Added');
    await expect(canvas.getByTestId('diff-consent-to-treatment')).toHaveTextContent('Changed');
    await expect(canvas.getByTestId('diff-legacy-notes')).toHaveTextContent('Removed');
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
};

export const Stale: Story = {
  name: 'Source form changed since import',
  args: { view: { ...BASE_VIEW, stale: true } },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent(/source form changed/);
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(args.onRefresh).toHaveBeenCalled();
  },
};

export const NoSourceForm: Story = {
  name: 'No source form selected - nothing to diff',
  args: {
    view: { ...BASE_VIEW, sourceFormId: null, diff: [] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('No source form was selected, so there is nothing to diff against.')
    ).toBeInTheDocument();
  },
};

export const DiscardDraft: Story = {
  name: 'Discard sends the current draft id',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Discard draft' }));
    await expect(args.onDiscard).toHaveBeenCalled();
  },
};
