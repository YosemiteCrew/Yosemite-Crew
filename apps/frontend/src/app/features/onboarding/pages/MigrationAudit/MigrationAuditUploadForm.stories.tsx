import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import MigrationAuditUploadForm from './MigrationAuditUploadForm';

const csvFile = (name: string) => new File(['external_id\n1'], name, { type: 'text/csv' });

const meta = {
  title: 'Onboarding/MigrationAuditUploadForm',
  component: MigrationAuditUploadForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The migration-audit upload step (#3057): one CSV per section (owners/animals/' +
          'appointments required, attachments optional), with the published column list and ' +
          'size/row limits shown up front since #3056 publishes no metadata endpoint for them.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    files: {},
    onFileChange: fn(),
    submitting: false,
    canSubmit: false,
    onSubmit: fn(),
  },
} satisfies Meta<typeof MigrationAuditUploadForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'No files chosen yet - submit disabled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/up to 5 MB and 5,000 rows/)).toBeInTheDocument();
    await expect(canvas.getAllByText('Required')).toHaveLength(3);
    await expect(canvas.getByText('Optional')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Run migration audit' })).toBeDisabled();
  },
};

export const ChooseFile: Story = {
  name: 'Choosing a file reports it to the container',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByLabelText('Owners'), csvFile('owners.csv'));
    await expect(args.onFileChange).toHaveBeenCalledWith(
      'owners',
      expect.objectContaining({ name: 'owners.csv' })
    );
  },
};

export const ReadyToSubmit: Story = {
  name: 'Every required file chosen - submit enabled',
  args: {
    files: {
      owners: csvFile('owners.csv'),
      animals: csvFile('animals.csv'),
      appointments: csvFile('appointments.csv'),
    },
    canSubmit: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('owners.csv')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Run migration audit' }));
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};

export const Uploading: Story = {
  name: 'Uploading - inputs disabled',
  args: {
    files: { owners: csvFile('owners.csv') },
    submitting: true,
    canSubmit: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Owners')).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Uploading…' })).toBeDisabled();
  },
};
