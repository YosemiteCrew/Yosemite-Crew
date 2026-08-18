import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import type { PaymentProgressState } from './invoiceStepHooks';
import { PaymentProgressOverlay } from './InvoiceStep';

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_progress_5b71d0e4ac93';

/** `checkoutUrl` is deliberately not defaulted: the delayed-without-link story needs it absent. */
const state = (
  status: PaymentProgressState['status'],
  checkoutUrl?: string
): PaymentProgressState => ({
  invoiceId: 'inv-2026-0416',
  checkoutUrl,
  startedAt: Date.UTC(2026, 2, 12, 9, 30),
  status,
});

const meta = {
  title: 'Appointments/PaymentProgressOverlay',
  component: PaymentProgressOverlay,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The blocking overlay shown while a Stripe checkout is outstanding. It is gated by a ' +
          'single line - `if (!state) return null` - and `state` is only ever set from a live ' +
          'payment poll, so no story, snapshot or test had drawn any of it.\n\n' +
          'What makes it worth stories is that the same dialog has **three completely different ' +
          'action layouts**, and they share no markup:\n\n' +
          '- `checking` renders a 64px `YosemiteLoader` and one lone `Abort` secondary;\n' +
          '- `confirmed` swaps the loader for a `size-14` success circle and renders one `Done` ' +
          'primary - deliberately never Abort (nothing left to abort) or Check again (already ' +
          'settled);\n' +
          '- `delayed` is the only branch with a `flex flex-wrap justify-center gap-3` row, and it ' +
          'holds three buttons - Abort, Continue editing, Check again.\n\n' +
          'That third branch is the risky one: three pill buttons inside a `max-w-115` dialog is ' +
          'the exact composition that wraps at narrow widths, and a wrapping row here changes the ' +
          "dialog's height rather than being clipped. The heading text also flips between " +
          '"Payment in progress" and "Payment confirmed" while the description comes from a ' +
          'separate `getPaymentProgressDescription` switch, so the two can disagree - only a ' +
          'rendered story pairs them.\n\n' +
          'Each story asserts the actual buttons for its branch, not merely that a dialog is ' +
          'present.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    state: state('checking', CHECKOUT_URL),
    onCheckAgain: fn(),
    onAbort: fn(),
    onContinue: fn(),
  },
} satisfies Meta<typeof PaymentProgressOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checking: Story = {
  name: 'Checking (loader + Abort)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Payment in progress' })).toBeInTheDocument();
    await expect(canvas.getByTestId('invoice-payment-progress-loader')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Reopen Stripe checkout' })).toHaveAttribute(
      'href',
      CHECKOUT_URL
    );
  },
  parameters: {
    docs: {
      story:
        'The state the user lands in the moment checkout opens. One action only, so the dialog is ' +
        'at its shortest - and the loader occupies the slot the success circle takes in the other ' +
        'two branches.',
    },
  },
};

export const Confirmed: Story = {
  name: 'Confirmed (success mark + Done)',
  args: { state: state('confirmed', CHECKOUT_URL) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    // Never Abort and never Check again once Stripe has settled.
    await expect(canvas.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument();
    await expect(canvas.queryByTestId('invoice-payment-progress-loader')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'Settled. The loader is replaced by a `size-14` `bg-success-100 / text-success-600` circle ' +
        'and every escape hatch collapses to a single Done. Offering Abort here would read as ' +
        '"undo the payment", which is why the branch is exclusive rather than additive.',
    },
  },
};

export const Delayed: Story = {
  name: 'Delayed (three-button row)',
  args: { state: state('delayed', CHECKOUT_URL) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Payment in progress' })).toBeInTheDocument();
    // The only branch that renders all three actions, in one wrapping flex row.
    await expect(canvas.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Continue editing' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    await expect(canvas.queryByTestId('invoice-payment-progress-loader')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'Confirmation has not arrived. This is the widest action row in the component and the only ' +
        'one that can wrap inside the `max-w-115` shell - the layout most likely to break, and the ' +
        'one nothing rendered before.',
    },
  },
};

export const DelayedWithoutCheckoutUrl: Story = {
  name: 'Delayed, no checkout link',
  args: { state: state('delayed') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('link', { name: 'Reopen Stripe checkout' })
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'A poll that resumed after a reload has no `checkoutUrl`, so the reopen link is dropped ' +
        'entirely and the gap between the description and the button row closes by one `gap-4` ' +
        'step. Same status, visibly different dialog.',
    },
  },
};

export const Dismissed: Story = {
  name: 'No state (renders nothing)',
  args: { state: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Query the dialog, not any heading: Storybook's own preview decorator puts an
    // sr-only <h1> inside the canvas, so a bare heading query never comes back empty.
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The `if (!state) return null` gate. Documented explicitly because the overlay is `fixed ' +
        'inset-0 z-[1100]` - if it ever rendered an empty shell instead of nothing, it would ' +
        'silently swallow every click on the page behind it.',
    },
  },
};
