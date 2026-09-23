import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import DraftImportForm from './DraftImportForm';
import './DeveloperFormDraftImport.css';

const SOURCE_OPTIONS = [
  { value: 'form-consent', label: 'Consent form' },
  { value: 'form-intake', label: 'New client intake' },
];

const meta = {
  title: 'Developers/DraftImportForm',
  component: DraftImportForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Supplied-text entry for #3055/#3060: an optional existing form to diff against, and ' +
          'the `label | type | required|optional | options` text the deterministic parser reads. ' +
          'Owns only its own field state - the page decides what a submission does.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    sourceOptions: SOURCE_OPTIONS,
    submitting: false,
    onSubmit: fn(),
  },
} satisfies Meta<typeof DraftImportForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty, submit disabled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Preview import' })).toBeDisabled();
  },
};

export const FilledIn: Story = {
  name: 'Text entered, source form chosen',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Existing form' }));
    const panel = document.querySelector('[data-portal-dropdown]');
    const option = within(panel as HTMLElement).getByText('Consent form');
    await userEvent.click(option);

    await userEvent.type(
      canvas.getByLabelText(/Supplied form text/),
      'Patient name | input | required'
    );

    const submit = canvas.getByRole('button', { name: 'Preview import' });
    await expect(submit).toBeEnabled();
    await userEvent.click(submit);

    await expect(args.onSubmit).toHaveBeenCalledWith({
      suppliedText: 'Patient name | input | required',
      sourceFormId: 'form-consent',
    });
  },
};

export const Submitting: Story = {
  name: 'Import in flight',
  args: { submitting: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Importing…' })).toBeDisabled();
  },
};

export const NoSourceForms: Story = {
  name: 'No published forms to compare against',
  args: { sourceOptions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Existing form' }));
    const panel = document.querySelector('[data-portal-dropdown]');
    await expect(
      within(panel as HTMLElement).getByText('No published forms to compare against')
    ).toBeInTheDocument();
  },
};
