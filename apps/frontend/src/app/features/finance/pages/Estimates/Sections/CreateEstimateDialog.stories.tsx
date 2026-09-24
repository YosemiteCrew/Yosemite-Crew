import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import CreateEstimateDialog from './CreateEstimateDialog';

const companions = [
  { id: 'pat-1', name: 'Marnie Whitlock' },
  { id: 'pat-2', name: 'Rufus Delacroix' },
  { id: 'pat-3', name: 'Pepper Osei' },
];

const meta = {
  title: 'Finance/CreateEstimateDialog',
  component: CreateEstimateDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The estimate editor.\n\n' +
          'The running totals are computed by `computeEstimateTotals`, which deliberately mirrors ' +
          "`computeTotals` in the backend's `EstimateService`: a line total excludes tax, tax is " +
          'applied per line as a percentage of that line, and the estimate total is the sum. If ' +
          'the two ever drift, the figure a client approves stops being the figure that is saved.\n\n' +
          "Validation mirrors the controller's zod schema for the same reason - at least one line, " +
          'a non-empty description, a quantity above zero, a non-negative price, tax within 0-100 - ' +
          'so the user is told what is wrong before a request goes out, instead of reading a ' +
          'flattened zod error afterwards.\n\n' +
          "Currency is the organisation's billing currency as the server resolves it " +
          '(`useCurrencyForPrimaryOrg`). The dialog previews in it and sends it, and the server ' +
          'refuses any other, so the figure previewed is saved in the currency previewed. While ' +
          'it is not known the totals show a bare amount and no currency is sent, and the server ' +
          'stores its own (#3607).',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    open: true,
    setOpen: () => {},
    companions,
    currency: 'GBP',
    saving: false,
    error: null,
    onSubmit: () => {},
  },
} satisfies Meta<typeof CreateEstimateDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'A fresh draft',
  play: async () => {
    const canvas = within(document.body);
    await expect(canvas.getByLabelText('Companion')).toBeInTheDocument();
    // One empty line, so its Remove control is disabled.
    await expect(canvas.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
  },
};

export const LiveTotals: Story = {
  name: 'Totals follow the lines',
  play: async () => {
    const canvas = within(document.body);
    await userEvent.type(canvas.getByLabelText('Line 1 description'), 'Bloods');
    const quantity = canvas.getByLabelText('Line 1 quantity');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '3');
    await userEvent.type(canvas.getByLabelText('Line 1 unit price'), '19.99');
    const tax = canvas.getByLabelText('Line 1 tax percent');
    await userEvent.clear(tax);
    await userEvent.type(tax, '20');

    // 3 x 19.99 = 59.97 before tax; 20% of that is 11.99 (11.994 rounded for
    // display only). The line cell shows the pre-tax figure, matching lineTotal.
    await expect(canvas.getAllByText('£59.97').length).toBeGreaterThan(0);
    await expect(canvas.getByText('£71.96')).toBeInTheDocument();
  },
};

export const RejectsAnEmptyDraft: Story = {
  name: 'Invalid draft is refused before any request',
  play: async () => {
    const canvas = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create this estimate' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Choose a companion for this estimate.'
    );
  },
};

export const Saving: Story = {
  name: 'Saving',
  args: { saving: true },
  play: async () => {
    await expect(
      within(document.body).getByRole('button', { name: 'Create this estimate' })
    ).toBeDisabled();
  },
};

export const EuroClinic: Story = {
  name: "Previews in the clinic's billing currency",
  args: { currency: 'EUR' },
  play: async () => {
    const canvas = within(document.body);
    await userEvent.type(canvas.getByLabelText('Line 1 description'), 'Bloods');
    await userEvent.type(canvas.getByLabelText('Line 1 unit price'), '40');
    await expect(canvas.getAllByText('€40.00').length).toBeGreaterThan(0);
  },
};

export const CurrencyNotYetKnown: Story = {
  name: 'Currency not known yet',
  args: { currency: undefined },
  play: async () => {
    const canvas = within(document.body);
    await userEvent.type(canvas.getByLabelText('Line 1 description'), 'Bloods');
    await userEvent.type(canvas.getByLabelText('Line 1 unit price'), '40');
    // A bare amount, not a guessed "$40.00".
    await expect(canvas.getAllByText('40.00').length).toBeGreaterThan(0);
    await expect(canvas.queryByText('$40.00')).not.toBeInTheDocument();
  },
};

export const ServerRejected: Story = {
  name: 'The server refused it',
  args: { error: 'Companion not found.' },
  play: async () => {
    await expect(within(document.body).getByRole('alert')).toHaveTextContent(
      'Companion not found.'
    );
  },
};
