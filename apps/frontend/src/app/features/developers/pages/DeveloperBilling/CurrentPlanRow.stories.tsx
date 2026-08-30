import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { DeveloperSubscription } from '@/app/services/developerBilling';

import CurrentPlanRow from './CurrentPlanRow';
import './DeveloperBilling.css';

/* Fixed dates, but never asserted as a literal: the row formats the period with
   `toLocaleDateString`, so "8/1/2026" is only correct for a runner in UTC or
   east of it. Every expectation derives the string the same way the component
   does - see `formattedPeriod` below. */
const PERIOD_START = '2026-08-01T00:00:00.000Z';
const PERIOD_END = '2026-09-01T00:00:00.000Z';

const formattedPeriod = `${new Date(PERIOD_START).toLocaleDateString()} – ${new Date(
  PERIOD_END
).toLocaleDateString()}`;

const subscription = (overrides: Partial<DeveloperSubscription> = {}): DeveloperSubscription => ({
  id: 'sub_storybook',
  organisationId: 'org-storybook',
  plan: 'pro',
  status: 'active',
  stripeSubscriptionItemId: 'si_storybook',
  currentPeriodStart: PERIOD_START,
  currentPeriodEnd: PERIOD_END,
  cancelAtPeriodEnd: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

/* Free has no Stripe object behind it at all, so the nulls travel together -
   an `id` with no period, or a period with no `id`, is not a state the API can
   produce. */
const freeSubscription = subscription({
  plan: 'free',
  id: null,
  stripeSubscriptionItemId: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
});

const meta = {
  title: 'Developers/DeveloperBilling/CurrentPlanRow',
  component: CurrentPlanRow,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The summary row above the plan grid: which tier is active, the period it covers, and ' +
          'the way out to the Stripe customer portal.\n\n' +
          'Two branches carry the whole component. The badge reports the **status** rather than ' +
          'the tier, so a failed charge reads "Past due" where "Pro" would be - the plan is still ' +
          'Pro and access is not revoked the moment a payment fails. And only the paid tiers have ' +
          'a Stripe object behind them, so Free shows no period and no portal link: there is ' +
          'nothing on the other end of it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    subscription: subscription(),
    loading: false,
    openingPortal: false,
    onManageBilling: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CurrentPlanRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Loading',
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading subscription…')).toBeInTheDocument();

    /* `loading` wins over the subscription it is handed - this story passes a
       full Pro subscription. If the guard were dropped the row would paint a
       badge and a portal button from data the page is still refreshing, and the
       tier would flicker between the stale and the fresh answer. */
    await expect(canvasElement.querySelector('.DevBilling-planBadge')).toBeNull();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

export const NoSubscription: Story = {
  name: 'No subscription (renders nothing)',
  args: { subscription: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Nothing at all, not an empty card: the page keeps the row mounted while
       the subscription read is failing, and an empty bordered box above the
       plan grid reads as "your plan is blank" rather than "we could not load
       it" - the page's own error line says that. */
    await expect(canvasElement.querySelector('.DevBilling-currentPlan')).toBeNull();
    await expect(canvas.queryByText('Loading subscription…')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the page renders when the subscription request failed: the row collapses and the ' +
          'page shows its own error line instead.',
      },
    },
  },
};

export const FreePlan: Story = {
  name: 'Free plan',
  args: { subscription: freeSubscription },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const badge = canvasElement.querySelector('.DevBilling-planBadge');
    await expect(badge).toHaveTextContent('Free');
    await expect(badge).toHaveClass('DevBilling-planBadge--free');

    /* Free is the branch the `isPro` check exists for. There is no Stripe
       customer behind it, so a portal button here would open a session for a
       customer that does not exist. */
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();

    /* Sentence, not an empty date range: `formatPeriod` returns '' for a null
       period, so the meter would otherwise read "Metered billing — " with a
       dangling dash. */
    await expect(canvas.getByTestId('billing-plan-meta')).toHaveTextContent(
      'You are on the Free plan.'
    );
  },
};

export const ProActive: Story = {
  name: 'Pro, active',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const badge = canvasElement.querySelector('.DevBilling-planBadge');
    await expect(badge).toHaveTextContent('Pro');
    await expect(badge).toHaveClass('DevBilling-planBadge--pro');

    await expect(canvas.getByTestId('billing-plan-meta')).toHaveTextContent(
      `Metered billing — ${formattedPeriod}`
    );

    /* The portal is the only card-management surface in the product, so the
       click has to reach the page - nothing else on this row is wired. */
    await userEvent.click(canvas.getByRole('button', { name: 'Manage billing' }));
    await expect(args.onManageBilling).toHaveBeenCalledTimes(1);
  },
};

export const PastDue: Story = {
  name: 'Past due',
  args: { subscription: subscription({ status: 'past_due' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Status, not tier. The subscription still says `plan: 'pro'` - only the
       badge changes, and it must not keep the tier class as well or the red
       past-due styling would land on top of the green Pro pill. */
    const badge = canvasElement.querySelector('.DevBilling-planBadge');
    await expect(badge).toHaveTextContent('Past due');
    await expect(badge).toHaveClass('DevBilling-planBadge--past_due');
    await expect(badge).not.toHaveClass('DevBilling-planBadge--pro');

    /* The portal stays: it is the only way the developer can fix the card, so
       hiding it on the one status that needs it would strand them. */
    await expect(canvas.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A failed charge badges the row without revoking anything. The plan is still Pro, the ' +
          'period still runs, and the portal button is the way out.',
      },
    },
  },
};

export const CancellingAtPeriodEnd: Story = {
  name: 'Cancelling at period end',
  args: { subscription: subscription({ cancelAtPeriodEnd: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The suffix is appended to the period, not swapped for it: the developer
       needs the date the access ends, which is the period end already shown. */
    const planMeta = canvas.getByTestId('billing-plan-meta');
    await expect(planMeta).toHaveTextContent(`Metered billing — ${formattedPeriod}`);
    await expect(planMeta).toHaveTextContent('· Cancels at period end');

    // Still Pro until the period actually ends - a pending cancel is not a downgrade.
    await expect(canvasElement.querySelector('.DevBilling-planBadge')).toHaveTextContent('Pro');
  },
};

export const OpeningPortal: Story = {
  name: 'Opening the portal',
  args: { openingPortal: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Opening…' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();

    /* Label swap only - the button is deliberately NOT disabled. Re-entry is
       guarded on the page (`if (openingPortal) return` in handleManageBilling),
       so a second click is swallowed rather than opening a second session. */
    await expect(canvas.getByRole('button', { name: 'Opening…' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pending state for the Stripe hand-off. The page never clears the flag on success - ' +
          'the browser is already navigating away, and resetting it would flash "Manage billing" ' +
          'over a page on its way out.',
      },
    },
  },
};

export const Enterprise: Story = {
  name: 'Enterprise',
  args: { subscription: subscription({ plan: 'enterprise' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const badge = canvasElement.querySelector('.DevBilling-planBadge');
    await expect(badge).toHaveTextContent('Enterprise');
    await expect(badge).toHaveClass('DevBilling-planBadge--enterprise');

    /* Enterprise is billed through Stripe like Pro, so it gets the portal too.
       An `isPro` check written as `plan === 'pro'` would silently strip card
       management from the tier paying the most. */
    await expect(canvas.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px the row stacks: the badge, the period and the portal button each take a ' +
          'full line, because `margin-left: auto` on the button has nothing to push against once ' +
          'the flex direction turns to column.',
      },
    },
  },
};
