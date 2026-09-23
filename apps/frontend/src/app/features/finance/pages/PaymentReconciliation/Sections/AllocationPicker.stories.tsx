import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import AllocationPicker from './AllocationPicker';
import type { AllocatableInvoice } from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';
import type { ReviewedLine } from '@/app/features/finance/pages/PaymentReconciliation/allocationDraft';

const invoice = (number: string, balance: number): AllocatableInvoice => ({
  id: `inv-${number}`,
  label: `#${number}`,
  currency: 'GBP',
  balance,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const OPTIONS: AllocatableInvoice[] = [invoice('7714', 92.5), invoice('7702', 60)];

const line = (
  option: AllocatableInvoice,
  amount: number | null,
  error: string | null = null
): ReviewedLine => ({ invoice: option, amount, error });

const meta = {
  title: 'Finance/Payment reconciliation/Allocation picker',
  component: AllocationPicker,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/payment-reconciliation' } },
    docs: {
      description: {
        component:
          'Which invoices a captured payment can be applied to, as pure props.\n\n' +
          'Three states, and the first two are different facts rather than two spellings ' +
          'of "nothing here": the invoices are still arriving, no invoice is eligible, or ' +
          'there is a list. A picker rendered empty while the store is loading reads as a ' +
          'screen that failed; one rendered empty with no sentence reads as a practice ' +
          'with no invoices rather than none this capture can pay.\n\n' +
          'The amount field appears only once an invoice is ticked. An empty box beside ' +
          'every unselected invoice reads as a form with a dozen things to fill in, when ' +
          'the operator is choosing one or two.\n\n' +
          'The list itself is already narrowed by the caller to the invoices the allocate ' +
          'route would accept, so this component filters nothing.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    options: OPTIONS,
    lines: [],
    amounts: {},
    loading: false,
    disabled: false,
    currency: 'GBP',
    onToggle: fn(),
    onAmountChange: fn(),
  },
} satisfies Meta<typeof AllocationPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NothingChosen: Story = {
  name: 'Nothing chosen yet',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('#7714')).toBeVisible();
    await expect(canvas.getByText('£92.50 owed')).toBeVisible();
    // No amount field until an invoice is ticked.
    await expect(canvas.queryByLabelText('Amount to apply to #7714')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('checkbox', { name: /#7714/ }));
    await expect(args.onToggle).toHaveBeenCalledWith('inv-7714');
  },
};

export const OneLineChosen: Story = {
  name: 'One line chosen',
  args: {
    lines: [line(OPTIONS[0], 92.5)],
    amounts: { 'inv-7714': '92.50' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('Amount to apply to #7714');
    await expect(field).toHaveValue('92.50');
    await expect(field).toHaveAttribute('aria-invalid', 'false');
  },
};

/** The error is bound to its own field, so a screen reader reaches it from there. */
export const LineOverTheInvoiceBalance: Story = {
  name: 'A line larger than the invoice owes',
  args: {
    lines: [line(OPTIONS[0], 999, 'More than this invoice still owes (£92.50).')],
    amounts: { 'inv-7714': '999' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('Amount to apply to #7714');
    await expect(field).toHaveAttribute('aria-invalid', 'true');

    const describedBy = field.getAttribute('aria-describedby');
    await expect(describedBy).toBeTruthy();
    await expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'More than this invoice still owes (£92.50).'
    );
  },
};

export const Loading: Story = {
  name: 'Waiting for the invoices',
  args: { options: [], loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading invoices...')).toBeVisible();
    await expect(canvas.queryByText(/No open invoice/)).not.toBeInTheDocument();
  },
};

export const NothingEligible: Story = {
  name: 'No invoice can take this capture',
  args: { options: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No open invoice in GBP/)).toBeVisible();
  },
};

/** Every control is inert while the request is on the wire. */
export const Submitting: Story = {
  name: 'A request in flight',
  args: {
    lines: [line(OPTIONS[0], 92.5)],
    amounts: { 'inv-7714': '92.50' },
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('checkbox', { name: /#7714/ })).toBeDisabled();
    await expect(canvas.getByLabelText('Amount to apply to #7714')).toBeDisabled();
  },
};
