import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import { PaymentActions } from './InvoiceStep';

/**
 * The exact copy `InvoiceStep` passes down while `readyForBilling` is false. Kept as a
 * constant so the story asserts the shipped sentence rather than a paraphrase of it -
 * a reworded tooltip should fail this story, not quietly pass a `/ready for billing/i`.
 */
const NOT_READY_REASON =
  'Mark this visit ready for billing before sending to client, collecting cash, or paying online.';

/** The three segment labels, in the order `PAYMENT_METHOD_LABELS` declares them. */
const METHODS = ['Online', 'Cash', 'Deposit'] as const;

const collectButton = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('button', { name: /^Collect / });

const meta = {
  title: 'Workspace/PaymentActions',
  component: PaymentActions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The payment-method card under the Total Bill: a three-way segmented control, one ' +
          'Collect action priced from `dueCents`, the payment-link status line, and - on ' +
          'in-patient encounters only - a Send-to-Client button.\n\n' +
          'The surface that had never been drawn is the **GlassTooltip around the Collect ' +
          'button**. It is conditional twice over. `InvoiceStep` only supplies ' +
          '`paymentDisabledReason` while the visit is not marked ready for billing, and ' +
          '`PaymentActions` then suppresses it again whenever the Deposit segment is selected, ' +
          'because a deposit is collectable before the visit is billable. So the wrapper is not ' +
          'a disabled tooltip that is merely closed - on two of the three segments the ' +
          '`.glass-tooltip` span is not in the DOM at all, and the button sits bare.\n\n' +
          'That matters for layout as well as copy. Both branches wrap the button in an ' +
          "`inline-flex w-full [&>*]:w-full` span, but the wrapped branch slips GlassTooltip's " +
          'own `relative inline-flex` span in above it - and that one carries no `w-full` of its ' +
          "own. It only spans the card because it is a stretch item in the section's column " +
          'flex. Nothing states that dependency, and a story that never renders the wrapped ' +
          'branch never exercises it.\n\n' +
          'The bubble opens on `mouseenter`/`focusin` bound in an effect, so the stories drive it ' +
          'through `openGlassTooltip` rather than `userEvent.hover`: a single dispatch fired ' +
          'before the effect flushes is lost, and no query-level retry re-sends it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    isInpatient: false,
    depositDisabled: false,
    paymentDisabled: true,
    paymentDisabledReason: NOT_READY_REASON,
    dueCents: 28_400,
    currency: 'USD',
    onCollect: fn(),
    onSendToClient: fn(),
    paymentLinkStatus: null,
  },
} satisfies Meta<typeof PaymentActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotReadyForBilling: Story = {
  name: 'Collect blocked (tooltip open)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const collect = collectButton(canvasElement);

    // `maximumFractionDigits: 0` in formatMoney - $284, not $284.00.
    await expect(collect).toHaveTextContent('Collect $284');
    await expect(collect).toBeDisabled();

    const bubble = await openGlassTooltip(collect);
    await expect(bubble).toHaveTextContent(NOT_READY_REASON);
    // `maxWidth={320}` reaches the portalled bubble as an inline style, and nothing
    // else in the card constrains it - unset, this sentence renders as one long line.
    await expect(getComputedStyle(bubble).maxWidth).toBe('320px');

    /* The bubble portals to document.body, so it is outside canvasElement entirely -
       exactly one tooltip is open, and it is not a descendant of the card. */
    await expect(within(document.body).getAllByRole('tooltip')).toHaveLength(1);
    await expect(canvas.queryByRole('tooltip')).not.toBeInTheDocument();

    await closeGlassTooltip(collect);
    await expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

    // Outpatient: no Send-to-Client row, so the card ends at the Collect button.
    await expect(canvas.queryByRole('button', { name: 'Send to Client' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state a fresh visit opens in: nothing is marked ready for billing, so Collect is ' +
          'disabled at 50% opacity and the only explanation is inside a bubble nobody had ' +
          'rendered. The bubble is opened and then closed again here, because a leftover bubble ' +
          'lives on `document.body` and would be counted by any later tooltip assertion in the ' +
          'same tab.',
      },
    },
  },
};

export const DepositSuppressesTheTooltip: Story = {
  name: 'Deposit selected (tooltip removed, not just closed)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(collectButton(canvasElement).closest('.glass-tooltip')).not.toBeNull();

    const deposit = canvas.getByRole('button', { name: 'Deposit' });
    await userEvent.click(deposit);

    /* The reason is dropped for DEPOSIT, so the whole wrapper unmounts. Asserting on
       `queryByRole('tooltip')` here would pass with the wrapper still present and
       merely closed, which is a different component tree. */
    const collect = collectButton(canvasElement);
    await expect(collect.closest('.glass-tooltip')).toBeNull();
    // Same `paymentDisabled` as the previous story, yet the button is now live:
    // `collectDisabled` reads `depositDisabled` on this segment.
    await expect(collect).toBeEnabled();
    await expect(collect).toHaveTextContent('Collect $284');

    await expect(deposit).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Online' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    /* The selected segment is the only one on `--screen` with a raised shadow; the
       others are transparent. Polled, because the segments carry `transition-colors`
       and a single synchronous read catches an interpolated background. */
    await waitFor(() => {
      expect(getComputedStyle(deposit).backgroundColor).not.toBe(
        getComputedStyle(canvas.getByRole('button', { name: 'Online' })).backgroundColor
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Clicking Deposit changes what the button is allowed to do, not only which segment is ' +
          'lit: `collectDisabled` switches from `paymentDisabled` to `depositDisabled`, and ' +
          '`disabledReason` becomes undefined. A deposit is taken before a visit is billable, so ' +
          'this is deliberate - but it means the same card renders two different trees under one ' +
          'set of props.',
      },
    },
  },
};

export const DepositSegmentUnavailable: Story = {
  name: 'Deposit segment disabled',
  args: { depositDisabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const segments = METHODS.map((label) => canvas.getByRole('button', { name: label }));
    await expect(segments).toHaveLength(3);
    await expect(segments[2]).toBeDisabled();
    await expect(segments[0]).toBeEnabled();
    await expect(segments[1]).toBeEnabled();

    // A disabled segment cannot become the selected one, so the tooltip stays.
    await userEvent.click(segments[2]);
    await expect(segments[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(collectButton(canvasElement).closest('.glass-tooltip')).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'While a payment is in flight `depositDisabled` is true, which greys the third segment ' +
          'but leaves the other two live. Worth drawing because it is the one combination where ' +
          'the escape hatch out of the tooltip is itself unreachable.',
      },
    },
  },
};

export const ReadyInpatientWithLink: Story = {
  name: 'Ready for billing (in-patient, link sent)',
  args: {
    isInpatient: true,
    paymentDisabled: false,
    paymentDisabledReason: undefined,
    paymentLinkStatus: { label: 'Stripe - payment link sent', isSent: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const collect = collectButton(canvasElement);
    await expect(collect).toBeEnabled();
    await expect(collect.closest('.glass-tooltip')).toBeNull();

    /* PaymentLinkStatus returns null on a null status, so this line exists only on
       an invoice that really is collecting through a Stripe link. It is an <output>,
       which is `role="status"`. */
    const status = canvas.getByRole('status');
    await expect(status).toHaveTextContent('Stripe - payment link sent');
    await expect(status.querySelector('.yc-workspace-pulse-dot')).not.toBeNull();

    // The in-patient-only row, separated by a `border-t` from the Collect button.
    await expect(canvas.getByRole('button', { name: 'Send to Client' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The unblocked card. Three things appear at once that no other story shows together: ' +
          'the bare (unwrapped) Collect button, the pulsing payment-link status line, and the ' +
          'Send-to-Client row that only in-patient encounters get.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone width',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 - it type-checks, renders and proves nothing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const collect = collectButton(canvasElement);
    const wrapper = collect.closest('.glass-tooltip') as HTMLElement;

    /* GlassTooltip's wrapper is `relative inline-flex` with no width of its own, so
       the full-width Collect button only stays full width while that span stretches
       as a flex item of the card. Measured with getBoundingClientRect rather than
       getComputedStyle: the rect is the border box on every element in the chain,
       so the three are actually comparable. */
    const inner = collect.parentElement as HTMLElement;
    await expect(collect.getBoundingClientRect().width).toBe(wrapper.getBoundingClientRect().width);
    await expect(inner.getBoundingClientRect().width).toBe(wrapper.getBoundingClientRect().width);
    // 375px viewport less the canvas padding, the card's own p-4 and its border -
    // roughly 309. A shrink-wrapped button would land near its ~130px text width,
    // so the threshold sits well clear of both.
    await expect(collect.getBoundingClientRect().width).toBeGreaterThan(250);
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the segmented control and the Collect button both still span the card. This ' +
          'is where the tooltip wrapper would show up as a defect if it ever lost its ' +
          '`w-full` overrides: the button would shrink to its text and sit left-aligned.',
      },
    },
  },
};
