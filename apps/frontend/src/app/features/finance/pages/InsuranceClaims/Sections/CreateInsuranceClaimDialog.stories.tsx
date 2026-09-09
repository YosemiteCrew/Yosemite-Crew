import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import CreateInsuranceClaimDialog, { type CompanionChoice } from './CreateInsuranceClaimDialog';

const COMPANIONS: CompanionChoice[] = [
  { id: 'pt-bramble', name: 'Bramble (Cavalier King Charles Spaniel)' },
  { id: 'pt-whiskers', name: 'Whiskers (Domestic Shorthair)' },
];

const meta = {
  title: 'InsuranceClaims/CreateInsuranceClaimDialog',
  component: CreateInsuranceClaimDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The insurance-claim create dialog. A claim always starts as a DRAFT, so there is no ' +
          'status control here - the claim is submitted and progressed later from its detail ' +
          'panel. This component owns only the modal shell, the save-time dismissal guard and the ' +
          'error line; the draft state and its validation live in `useInsuranceClaimDraft`, and ' +
          'the fields themselves in `InsuranceClaimFormFields`.\n\n' +
          'A create request cannot be cancelled once it is in flight, so every dismissal route is ' +
          'closed while `saving` is true - the Cancel button is disabled, and `CenterModal` also ' +
          'stops responding to Escape and an outside click, not just the visible button. The error ' +
          'line prefers the client-side validation message over the caller-supplied `error` prop, ' +
          'so a request is only ever sent once the form is locally valid.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    open: { control: 'boolean' },
    saving: { control: 'boolean' },
    error: { control: 'text' },
    currency: { control: 'text' },
  },
  args: {
    open: true,
    setOpen: fn(),
    companions: COMPANIONS,
    currency: 'GBP',
    saving: false,
    error: null,
    onSubmit: fn(),
  },
} satisfies Meta<typeof CreateInsuranceClaimDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Saving: Story = {
  name: 'Saving (every dismissal route closed)',
  args: { saving: true },
};

export const ServerError: Story = {
  name: 'Server rejected the claim',
  args: { error: 'This insurer already has an open claim for the selected policy.' },
};

export const NoCompanions: Story = {
  name: 'No companions to file for',
  args: { companions: [] },
};

export const ValidationError: Story = {
  name: 'Refuses an incomplete claim',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Create this insurance claim' }));

    // Caught locally by useInsuranceClaimDraft before any request goes out.
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Choose a companion for this claim.'
    );
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const SubmittedSuccessfully: Story = {
  name: 'Fills the form and submits',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Companion' }),
      'pt-bramble'
    );
    await userEvent.type(canvas.getByLabelText('Insurer'), 'Pawsome Insurance');
    await userEvent.type(canvas.getByLabelText('Policy number'), 'POL-4471');
    await userEvent.type(canvas.getByLabelText('Submitted amount (£)'), '250');

    await userEvent.click(canvas.getByRole('button', { name: 'Create this insurance claim' }));

    await expect(args.onSubmit).toHaveBeenCalledWith({
      patientId: 'pt-bramble',
      insurerName: 'Pawsome Insurance',
      policyNumber: 'POL-4471',
      submittedAmount: 250,
      currency: 'GBP',
    });
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};
