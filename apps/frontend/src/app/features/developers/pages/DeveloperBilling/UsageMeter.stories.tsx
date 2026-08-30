import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type { DeveloperUsage } from '@/app/services/developerUsage';

import UsageMeter from './UsageMeter';
import './DeveloperBilling.css';

const usage = (callCount: number, limit: number | null): DeveloperUsage => ({
  billingPeriod: '2026-08',
  callCount,
  limit,
});

/* The bar is a native <progress>, so the numbers worth checking are the
   element's own value/max - the browser draws the fill from them and the width
   is never in the DOM to read. */
const meterOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('progressbar') as HTMLProgressElement;

const meta = {
  title: 'Developers/DeveloperBilling/UsageMeter',
  component: UsageMeter,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Calls consumed in the current billing period, in three shapes: **capped** (a plan with ' +
          'an included allowance reports `limit`, and the bar fills against it), **metered** ' +
          '(`limit: null`, so the count is shown bare) and **exhausted** (at or past the ' +
          'allowance, where the bar turns red and the copy names the 429 the API is about to ' +
          'start returning).\n\n' +
          'It renders only what the API returns. The "first 1,000 calls free" on the Pro card is ' +
          'a tier on the Stripe price, not a number this app owns, so nothing here is recomputed ' +
          'into a billable-calls figure that could disagree with the invoice.',
      },
    },
  },
  tags: ['autodocs'],
  args: { usage: usage(120, 1000) },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UsageMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithinAllowance: Story = {
  name: 'Within the allowance',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const meter = meterOf(canvasElement);

    /* <progress> carries the semantics itself - no hand-written aria-value*.
       The label is the only part that is not free, and without it the bar is
       announced as an unnamed progress indicator. */
    await expect(meter).toHaveAttribute('aria-label', 'Included API calls used this period');
    await expect(meter.value).toBe(120);
    await expect(meter.max).toBe(1000);

    // Thousands separators on both halves, so 1000 never reads as "1000".
    await expect(canvas.getByTestId('billing-usage')).toHaveTextContent('120 / 1,000');
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const AlmostSpent: Story = {
  name: 'One call left',
  args: { usage: usage(999, 1000) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The boundary: the warning fires at `callCount >= allowance`, so 999 of
       1,000 is the last state that still has an allowance left. An off-by-one
       here would tell a developer their integration is about to start failing
       while it still has a call in hand. */
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(meterOf(canvasElement)).not.toHaveClass('DevBilling-usageTrack--exhausted');
  },
};

export const AllowanceSpent: Story = {
  name: 'Allowance spent',
  args: { usage: usage(1000, 1000) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* role="alert" rather than a red paragraph: this is the only place in the
       portal that explains why calls have started returning 429, and colour
       alone would not reach a screen reader. */
    const warning = canvas.getByRole('alert');
    await expect(warning).toHaveTextContent('You have used your monthly allowance.');
    await expect(warning).toHaveTextContent('429');

    const meter = meterOf(canvasElement);
    await expect(meter).toHaveClass('DevBilling-usageTrack--exhausted');
    await expect(meter.value).toBe(meter.max);
  },
};

export const OverAllowance: Story = {
  name: 'Past the allowance',
  args: { usage: usage(1450, 1000) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const meter = meterOf(canvasElement);

    /* The count is honest about the overage while the bar is clamped to the
       track: `Math.min(callCount, allowance)`. Without the clamp the fill would
       be told to draw 145% and the bar would either overflow its rounded track
       or silently saturate depending on the engine. */
    await expect(canvas.getByTestId('billing-usage')).toHaveTextContent('1,450 / 1,000');
    await expect(meter.value).toBe(1000);
    await expect(meter.max).toBe(1000);
    await expect(canvas.getByRole('alert')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Usage can pass the allowance: the counter is reported by the backend after the fact, ' +
          'so in-flight calls land above the cap before the 429s begin.',
      },
    },
  },
};

export const Metered: Story = {
  name: 'Metered, no cap',
  args: { usage: usage(48_250, null) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* No bar on a metered plan: there is nothing to fill toward, and a bar
       against an invented ceiling would imply a cap that does not exist. */
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    const count = canvasElement.querySelector('.DevBilling-usageCount');
    await expect(count).toHaveTextContent('48,250');
    // The " / limit" suffix has to go with the bar, not linger as "48,250 / null".
    await expect(count?.textContent ?? '').not.toContain('/');

    await expect(canvas.getByText(/Metered — billed at the end of the period/)).toBeInTheDocument();
  },
};

export const ZeroLimit: Story = {
  name: 'Limit of zero',
  args: { usage: usage(40, 0) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `limit: 0` is not an allowance of nothing, it is no allowance to show. As
       a denominator it makes the fill 0/0 -> NaN, which reaches the DOM as the
       invalid `width: NaN%` and paints an empty track that looks like a working
       meter. Non-positive limits fall back to the metered rendering instead. */
    await expect(canvasElement.textContent ?? '').not.toContain('NaN');
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('.DevBilling-usageLimit')).toBeNull();

    // And no false alarm: 40 >= 0 must not be read as an exhausted allowance.
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(canvas.getByText(/Metered — billed at the end of the period/)).toBeInTheDocument();
  },
};
