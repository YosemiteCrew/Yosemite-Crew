import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PlanCard from './PlanCard';
import { PLANS, type BillingPlan } from './plans';
import './DeveloperBilling.css';

/* Read out of PLANS rather than re-typed here: the copy on these cards is the
   pricing page, and a fixture that drifts from it would let a wrong price ship
   with a green story. `find` + fallback rather than `!` - the lint config bans
   non-null assertions. */
const planFor = (key: BillingPlan['key']): BillingPlan =>
  PLANS.find((candidate) => candidate.key === key) ?? PLANS[0];

const FREE = planFor('free');
const PRO = planFor('pro');
const ENTERPRISE = planFor('enterprise');

const meta = {
  title: 'Developers/DeveloperBilling/PlanCard',
  component: PlanCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One tier in the plan grid. Every tier is always offered; only the current one is ' +
          'marked and its action disabled - you cannot "upgrade" to the plan you are already on.' +
          '\n\n' +
          'The footer action is branched per tier rather than driven by one prop, because the ' +
          'three tiers do genuinely different things: Free has no downgrade flow at all, Pro ' +
          'opens Stripe checkout, and Enterprise is a mailto to sales. That gives nine renders ' +
          'from three inputs (`plan` x `isCurrent`/`checkingOut`), which the page story only ever ' +
          'shows in one combination.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    plan: PRO,
    isCurrent: false,
    checkingOut: false,
    onUpgrade: fn(),
  },
  decorators: [
    /* The card is a grid child in the page: `.DevBilling-plans` supplies the
       12px of headroom the recommended ribbon hangs in, so a bare card would
       have its ribbon clipped by the panel edge and look like a bug in the
       card. */
    (Story) => (
      <div className="DevBilling-plans" style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Free: Story = {
  name: 'Free',
  args: { plan: FREE },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* Disabled, and not because it is the current plan - there is no downgrade
       flow behind it at all. The button exists to keep the three cards the same
       shape; if it ever became clickable it would do nothing. */
    const action = canvas.getByRole('button', { name: 'Downgrade' });
    await expect(action).toBeDisabled();
    await expect(canvas.getAllByRole('button')).toHaveLength(1);

    // Every feature line is a real list item, so the tier is readable as a list.
    await expect(canvas.getAllByRole('listitem')).toHaveLength(FREE.features.length);

    await userEvent.click(action, { pointerEventsCheck: 0 });
    await expect(args.onUpgrade).not.toHaveBeenCalled();
  },
};

export const FreeCurrent: Story = {
  name: 'Free, current plan',
  args: { plan: FREE, isCurrent: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The label swaps to "Current plan" but the disabled state does not move -
       Free is inert either way, which is why this card ignores `checkingOut`
       too. */
    await expect(canvas.getByRole('button', { name: 'Current plan' })).toBeDisabled();
    await expect(canvas.getByTestId('plan-card-free')).toHaveClass('DevBilling-planCard--current');
  },
};

export const ProRecommended: Story = {
  name: 'Pro (recommended)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByTestId('plan-card-pro');

    await expect(card).toHaveClass('DevBilling-planCard--recommended');

    /* The "Most popular" ribbon is CSS `content` on a ::before, so no text query
       can see it and a dropped rule would go unnoticed until someone looked at
       the page. Read it off the computed style instead. */
    const ribbon = globalThis.getComputedStyle(card, '::before').content;
    await expect(ribbon).toContain('Most popular');

    /* Pro is the only tier with a checkout flow, so it is the only card whose
       action has to reach the page. */
    await userEvent.click(canvas.getByRole('button', { name: 'Upgrade to Pro' }));
    await expect(args.onUpgrade).toHaveBeenCalledTimes(1);
  },
};

export const ProCurrent: Story = {
  name: 'Pro, current plan',
  args: { isCurrent: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByTestId('plan-card-pro');

    await expect(card).toHaveClass('DevBilling-planCard--current');

    /* The ribbon is suppressed on the plan you are already on: "Most popular"
       over "Current plan" is an advert to buy what you have bought, and the
       12px of ribbon headroom would push this card out of line with its
       neighbours for nothing. */
    await expect(card).not.toHaveClass('DevBilling-planCard--recommended');
    await expect(globalThis.getComputedStyle(card, '::before').content).toBe('none');

    const action = canvas.getByRole('button', { name: 'Current plan' });
    await expect(action).toBeDisabled();
    await userEvent.click(action, { pointerEventsCheck: 0 });
    await expect(args.onUpgrade).not.toHaveBeenCalled();
  },
};

export const ProCheckingOut: Story = {
  name: 'Pro, redirecting to checkout',
  args: { checkingOut: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const action = canvas.getByRole('button', { name: 'Redirecting…' });

    /* Disabled while the checkout session is being created, not just relabelled:
       the page is mid-await on Stripe, and a second click would open a second
       session for the same organisation. */
    await expect(action).toBeDisabled();
    await userEvent.click(action, { pointerEventsCheck: 0 });
    await expect(args.onUpgrade).not.toHaveBeenCalled();
  },
};

export const Enterprise: Story = {
  name: 'Enterprise',
  args: { plan: ENTERPRISE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Deliberately not clicked: the handler assigns `window.location.href` to a
       mailto, which would take the story iframe with it. */
    const action = canvas.getByRole('button', { name: 'Contact us' });
    await expect(action).toBeEnabled();

    /* Sales-led, so this tier never reaches the checkout handler - the card
       calls out to a mailto instead, and `onUpgrade` is not wired to it. */
    await expect(canvas.getAllByRole('listitem')).toHaveLength(ENTERPRISE.features.length);
    await expect(canvas.getByTestId('plan-card-enterprise')).not.toHaveClass(
      'DevBilling-planCard--current'
    );
  },
};

export const EnterpriseCurrent: Story = {
  name: 'Enterprise, current plan',
  args: { plan: ENTERPRISE, isCurrent: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The mailto is removed with the label, not left under a disabled button:
       an existing enterprise customer contacting sales to buy the plan they are
       on is a support ticket, not a lead. */
    await expect(canvas.getByRole('button', { name: 'Current plan' })).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: 'Contact us' })).not.toBeInTheDocument();
  },
};
