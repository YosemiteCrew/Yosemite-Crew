import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { DepositModal } from './InvoiceStep';

const PAYMENT_LINK = 'https://checkout.stripe.com/c/pay/cs_test_deposit_9f2c41ab8d7e';

/** The modal portals to `document.body`, so every assertion queries the document. */
const findDialog = async () => {
  const dialog = await within(document.body).findByRole('dialog');
  await expect(dialog).toBeInTheDocument();
  return dialog;
};

const meta = {
  title: 'Appointments/DepositModal',
  component: DepositModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Collect-deposit dialog from the invoice step. It is gated twice over: it mounts ' +
          'only while `open` is true, and `CenterModal` -> `ModalBase` `createPortal`s it to ' +
          '`document.body`, so it never appears inside a story canvas by accident. Nothing had ' +
          'ever rendered it.\n\n' +
          'The branch most worth drawing is the **generated-payment-link** block. It is an ' +
          '`<output>` - not a div - carrying `rounded-2xl bg-primary-100 p-3` with a `break-all ' +
          'underline` anchor inside, and it exists only after an online deposit round-trips and ' +
          'the parent hands back `generatedLink`. It is inserted between the Notes textarea and ' +
          'the action row, so it pushes Cancel/Generate down and is the one thing that can make ' +
          'this dialog outgrow its `sm:w-[560px]` shell. A URL with no spaces is exactly the ' +
          'content that overflows a container without `break-all`, and only a rendered story shows ' +
          'that.\n\n' +
          'The method pair is a `grid gap-2 sm:grid-cols-2` of two buttons rather than a radio ' +
          'group, and it changes the primary action label through `getDepositModalActionLabel`: ' +
          'Cash reads "Collect deposit", Online reads "Generate link", and an in-flight save ' +
          'overrides both with "Saving...". Three labels on one button, none of them reachable ' +
          'without interacting.\n\n' +
          'The stories assert the dialog body actually carries its fields and its link, not merely ' +
          'that a dialog exists - an empty dialog would satisfy the weaker check.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    open: true,
    saving: false,
    generatedLink: null,
    onClose: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof DepositModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CashDeposit: Story = {
  name: 'Open (cash)',
  play: async () => {
    const dialog = await findDialog();
    const panel = within(dialog);
    await expect(panel.getByRole('heading', { name: 'Collect deposit' })).toBeInTheDocument();
    await expect(panel.getByLabelText('Amount')).toHaveValue(100);
    await expect(panel.getByLabelText('Reference')).toBeInTheDocument();
    await expect(panel.getByLabelText('Notes')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Collect deposit' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The default entry state: Cash selected, amount seeded at 100. The label wraps its input ' +
        'rather than using `htmlFor`, so the field names come from the wrapper - worth confirming ' +
        'they resolve at all, since a nested-label mistake reads fine visually.',
    },
  },
};

export const OnlineDeposit: Story = {
  name: 'Online selected (relabelled action)',
  play: async () => {
    const dialog = await findDialog();
    const panel = within(dialog);
    await userEvent.click(panel.getByRole('button', { name: 'Online link' }));
    // The primary action is relabelled by the method choice, not by a separate prop.
    await expect(await panel.findByRole('button', { name: 'Generate link' })).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Collect deposit' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'Picking Online swaps the selected card to `border-primary-500 bg-primary-100 ' +
        'text-blue-text` and rewrites the primary action to "Generate link". Nothing else on the ' +
        'form changes, so the label is the only signal that the submit now does something ' +
        'different.',
    },
  },
};

export const LinkGenerated: Story = {
  name: 'Payment link returned',
  args: { generatedLink: PAYMENT_LINK },
  play: async () => {
    const dialog = await findDialog();
    const panel = within(dialog);
    await expect(panel.getByText('Payment link generated:')).toBeInTheDocument();
    const link = panel.getByRole('link', { name: PAYMENT_LINK });
    await expect(link).toHaveAttribute('href', PAYMENT_LINK);
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  },
  parameters: {
    docs: {
      story:
        'The state this file exists for. A long unbroken checkout URL inside the `<output>` block, ' +
        'sitting between Notes and the action row - the only composition where `break-all` is ' +
        'load-bearing and where the dialog is at its tallest.',
    },
  },
};

export const Saving: Story = {
  name: 'Saving (in flight)',
  args: { saving: true },
  play: async () => {
    const dialog = await findDialog();
    const panel = within(dialog);
    const action = panel.getByRole('button', { name: 'Saving...' });
    await expect(action).toBeDisabled();
  },
  parameters: {
    docs: {
      story:
        'The pending label overrides both method labels and the button disables, but Cancel stays ' +
        'live - so a stuck request can still be dismissed rather than trapping the dialog.',
    },
  },
};

export const ZeroAmount: Story = {
  name: 'Zero amount (submit blocked)',
  play: async () => {
    const dialog = await findDialog();
    const panel = within(dialog);
    await userEvent.clear(panel.getByLabelText('Amount'));
    await userEvent.type(panel.getByLabelText('Amount'), '0');
    await expect(panel.getByRole('button', { name: 'Collect deposit' })).toBeDisabled();
  },
  parameters: {
    docs: {
      story:
        'A zero (or unparseable) amount disables the primary via `amountNumber <= 0`. There is no ' +
        'inline error line, so the disabled button is the entire feedback - which is only visible ' +
        'once the field has actually been emptied.',
    },
  },
};
