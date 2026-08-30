import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type { PaymentLinkStatus as PaymentLinkStatusModel } from '@/app/features/appointments/lib/paymentLinkStatus';
import PaymentLinkStatus from './PaymentLinkStatus';

const READY: PaymentLinkStatusModel = { label: 'Stripe · payment link ready', isSent: false };
const SENT: PaymentLinkStatusModel = { label: 'Stripe · payment link sent', isSent: true };

const meta = {
  title: 'Workspace/PaymentLinkStatus',
  component: PaymentLinkStatus,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The muted status line under the workspace Collect action. Two frames and one of them ' +
          'is empty.\n\n' +
          '**The label never overstates what the data proves.** A Stripe payment link that exists ' +
          'is "ready"; it only becomes "sent" once the backend stamps `paymentLinkSentAt`. ' +
          '`derivePaymentLinkStatus` returns `null` for everything else - no link, a closed ' +
          'invoice, a different collection method - and a null status renders nothing at all ' +
          'rather than a placeholder or an empty row that reserves height.\n\n' +
          '**The line is an `<output>`, not a `<span>`.** That gives it `role="status"`, so the ' +
          'state is announced when it appears next to the Collect button; a plain span would ' +
          'change silently for a screen reader. The pulsing dot is decorative and stays ' +
          '`aria-hidden`, with its keyframe scoped in `PaymentLinkStatus.css` and flattened under ' +
          '`prefers-reduced-motion`.',
      },
    },
  },
  tags: ['autodocs'],
  args: { status: READY },
} satisfies Meta<typeof PaymentLinkStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LinkReady: Story = {
  name: 'Payment link ready',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // role=status comes from the <output> element, not from an attribute anyone
    // wrote, so swapping the tag for a span would drop the announcement with no
    // visible change whatsoever.
    const line = canvas.getByRole('status');
    await expect(line).toHaveTextContent('Stripe · payment link ready');

    const dot = line.querySelector('.yc-workspace-pulse-dot') as HTMLElement;
    await expect(dot).toHaveAttribute('aria-hidden', 'true');
    // size-1.5 -> 6px. The dot is the only thing distinguishing this line from
    // any other caption, and a collapsed dot reads as a rendering glitch.
    await expect(dot.getBoundingClientRect().width).toBe(6);

    // The keyframe ships in the component's own stylesheet rather than
    // globals.css, so a dropped `import './PaymentLinkStatus.css'` leaves a
    // static dot and nothing else fails.
    const reduced = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await expect(globalThis.getComputedStyle(dot).animationName).toBe(
      reduced ? 'none' : 'ycWorkspacePulseDot'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A link exists on an open invoice but nothing has confirmed it reached the client. This ' +
          'is the frame most invoices sit in.',
      },
    },
  },
};

export const LinkSent: Story = {
  name: 'Payment link sent',
  args: { status: SENT },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only the wording changes between the two states - same dot, same ink - so
    // the label is the entire difference a reader gets.
    await expect(canvas.getByRole('status')).toHaveTextContent('Stripe · payment link sent');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reached only once the backend stamps `paymentLinkSentAt`. Creating the link is not ' +
          'evidence it was delivered, which is why this is a separate state rather than the ' +
          'default wording.',
      },
    },
  },
};

export const NoPaymentLink: Story = {
  name: 'No payment link (renders nothing)',
  args: { status: null },
  /**
   * The component returns null here, so there is nothing to query. The slot
   * gives the assertion something to be empty: without it "renders nothing" and
   * "the story failed to mount" look identical.
   */
  decorators: [
    (Story) => (
      <div data-testid="status-slot">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slot = canvas.getByTestId('status-slot');
    await expect(slot.childElementCount).toBe(0);
    await expect(slot).toBeEmptyDOMElement();
    // Nothing announced either - an empty <output> would still be a live region.
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An invoice with no Stripe payment link, a closed invoice, or one collecting some other ' +
          'way. The Collect action sits alone with no gap under it - the line reserves no height ' +
          'when it has nothing to say.',
      },
    },
  },
};
