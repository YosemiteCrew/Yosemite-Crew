import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { expect, waitFor, within } from 'storybook/test';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import type {
  DeveloperPlanTier,
  DeveloperSubscriptionStatus,
} from '@/app/services/developerBilling';
import DeveloperBilling from './DeveloperBilling';

/**
 * As with the API-keys stories, only the axios ADAPTER is swapped so the real
 * service, interceptors and `{ data: ... }` envelope stay in the path.
 *
 * Worth knowing while reading these: this page's stylesheet was, until
 * recently, written entirely against tokens that do not exist in `globals.css`
 * (`--spacing-*`, `--radius-*`, `--color-surface-*`) with no fallbacks, so every
 * declaration was invalid at computed-value time and the page rendered
 * unstyled. These stories are the regression net for that - Chromatic will now
 * catch it if the card vocabulary drifts again.
 */
type Handler = (config: InternalAxiosRequestConfig) => { status?: number; body?: unknown };

const stubApi = (handler: Handler) => {
  const previous = api.defaults.adapter;
  api.defaults.adapter = async (config) => {
    const { status = 200, body = {} } = handler(config);
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status ${status}`), {
        response: { status, data: body, config },
        config,
      });
    }
    return { data: body, status, statusText: 'OK', headers: {}, config } as AxiosResponse;
  };
  return () => {
    api.defaults.adapter = previous;
  };
};

const seedDeveloper = () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({
    status: 'authenticated',
    role: 'developer',
    user: {
      userId: 'dev-storybook',
      email: 'ravi@example.test',
      authProfile: null,
      loginMethod: 'emailpassword',
      emailVerified: true,
      getUsername: () => 'dev-storybook',
    },
    attributes: { sub: 'dev-storybook', email: 'ravi@example.test', email_verified: 'true' },
  });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

const subscription = (plan: DeveloperPlanTier, status: DeveloperSubscriptionStatus) => ({
  id: plan === 'free' ? null : 'sub_123',
  plan,
  status,
  stripeSubscriptionItemId: plan === 'free' ? null : 'si_123',
  currentPeriodStart: plan === 'free' ? null : '2026-08-01T00:00:00.000Z',
  currentPeriodEnd: plan === 'free' ? null : '2026-09-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

const usage = (callCount: number, limit: number | null) => ({
  billingPeriod: '2026-08',
  callCount,
  limit,
});

/**
 * The page fetches the subscription and the usage counter in parallel, so a stub
 * has to answer on the URL. A single-body handler would hand the subscription
 * payload to the usage request too, and the meter would render blanks while
 * still looking wired up.
 */
const routed = (
  sub: unknown,
  use: unknown,
  status?: { subscription?: number; usage?: number }
): Handler => {
  return (config) =>
    config.url?.includes('/usage')
      ? { status: status?.usage, body: { data: use } }
      : { status: status?.subscription, body: { data: sub } };
};

const setup = (handler: Handler) => () => {
  clearInFlightGetRequests();
  const restoreAuth = seedDeveloper();
  const restoreApi = stubApi(handler);
  return () => {
    restoreApi();
    restoreAuth();
    clearInFlightGetRequests();
  };
};

const meta = {
  title: 'Developers/DeveloperBilling',
  component: DeveloperBilling,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/billing' } },
    docs: {
      description: {
        component:
          'Plan selection and metered billing for API usage.\n\n' +
          'Three tiers: **Free** (no Stripe object at all - `id` and the period dates are null), ' +
          '**Pro** (metered, one Stripe price, usage reported per call) and **Enterprise** ' +
          '(custom, sales-led). The current tier is both badged in the summary row and marked on ' +
          'its card, and that card’s action is disabled - you cannot "upgrade" to the plan you ' +
          'are already on.\n\n' +
          '`past_due` is a status, not a tier: it badges the summary row red while the plan ' +
          'itself stays Pro, because access is not revoked the moment a payment fails.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: setup(routed(subscription('free', 'active'), usage(120, 1000))),
} satisfies Meta<typeof DeveloperBilling>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreePlan: Story = {
  name: 'Free plan',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => expect(canvas.getByTestId('billing-plan-meta')).toBeInTheDocument());

    /* "Free" appears twice - once as the status badge, once as the plan card's
       name - so this pins the badge by class rather than by text, which would
       match both and pass even if the badge disappeared. */
    const badge = canvasElement.querySelector('.DevBilling-planBadge');
    await expect(badge).toHaveTextContent('Free');
    await expect(badge).toHaveClass('DevBilling-planBadge--free');

    // All three tiers are always offered; only the current one is marked.
    await expect(canvas.getByTestId('plan-card-free')).toBeInTheDocument();
    await expect(canvas.getByTestId('plan-card-pro')).toBeInTheDocument();
    await expect(canvas.getByTestId('plan-card-enterprise')).toBeInTheDocument();

    /* On Free the free card's own action reads "Current plan" and is inert,
       while Pro stays actionable - that asymmetry is the whole upgrade path. */
    await expect(canvas.getAllByText('Current plan').length).toBeGreaterThan(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default for a new developer. There is no Stripe subscription behind this state, ' +
          'so the summary row shows no billing period - the component renders the tier alone ' +
          'rather than an empty date range.',
      },
    },
  },
};

export const ProPlan: Story = {
  name: 'Pro plan (metered)',
  beforeEach: setup(routed(subscription('pro', 'active'), usage(48_250, null))),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('billing-plan-meta')).toBeInTheDocument());

    /* Pro is the only tier with a real Stripe object, so it is the only one that
       can show a period and offer the customer portal. */
    await expect(canvas.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
    await expect(canvas.getByTestId('billing-plan-meta')).toHaveTextContent('Metered billing');
  },
  parameters: {
    docs: {
      description: {
        story:
          '"Manage billing" hands off to the Stripe customer portal rather than reimplementing ' +
          'card management - the return URL brings the developer back to this page.',
      },
    },
  },
};

export const PastDue: Story = {
  name: 'Past due',
  beforeEach: setup(routed(subscription('pro', 'past_due'), usage(48_250, null))),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The badge reports the STATUS, not the tier: a failed payment shows "Past
       due" where "Pro" would be, while the Pro card stays marked as current. */
    await waitFor(() => expect(canvas.getByText('Past due')).toBeInTheDocument());
    await expect(canvas.getByTestId('plan-card-pro')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Access is not cut off here - the developer keeps working while the badge and the ' +
          'Stripe portal give them a way to fix the card. Revocation is a separate, later step.',
      },
    },
  },
};

export const AllowanceSpent: Story = {
  name: 'Free plan, allowance spent',
  beforeEach: setup(routed(subscription('free', 'active'), usage(1000, 1000))),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('billing-usage')).toBeInTheDocument());

    /* The bar turning red is the visual signal; the sentence is the actionable
       one, because a 429 from the API is otherwise unexplained. */
    await expect(canvas.getByText(/used your monthly allowance/)).toBeInTheDocument();
    const bar = canvasElement.querySelector('.DevBilling-usageTrack');
    await expect(bar).toHaveClass('DevBilling-usageTrack--exhausted');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state a developer hits right before their integration starts failing. The meter ' +
          'is the only place in the portal that explains why calls have begun returning 429, so ' +
          'it names the status code and points at the upgrade.',
      },
    },
  },
};

export const MeteredUsage: Story = {
  name: 'Pro plan, metered usage',
  beforeEach: setup(routed(subscription('pro', 'active'), usage(48_250, null))),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('billing-usage')).toBeInTheDocument());

    /* No bar on a metered plan: there is nothing to fill toward, and a bar
       against an invented ceiling would imply a cap that does not exist. */
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument();
    await expect(canvas.getByTestId('billing-usage')).toHaveTextContent('48,250');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Metered plans report `limit: null`, so the meter shows the raw count and no bar.\n\n' +
          'It deliberately stops short of estimating a bill. The "first 1,000 calls free" on the ' +
          'Pro card is a tier on the Stripe price, not a number this app holds, so computing a ' +
          'billable figure here could disagree with the actual invoice.',
      },
    },
  },
};

export const UsageUnavailable: Story = {
  name: 'Usage unavailable',
  beforeEach: setup(routed(subscription('pro', 'active'), null, { usage: 403 })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('billing-plan-meta')).toBeInTheDocument());

    /* The meter is fetched alongside the subscription but settled separately, so
       losing it costs the meter and nothing else - no page-level error. */
    await expect(canvas.queryByTestId('billing-usage')).not.toBeInTheDocument();
    await expect(canvas.getByTestId('plan-card-pro')).toBeInTheDocument();
    await expect(
      canvas.queryByText('Could not load your subscription. Please try again.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The two requests are settled independently, so a failing usage counter degrades to a ' +
          'missing meter rather than taking the plan cards down with it.',
      },
    },
  },
};

export const LoadFailed: Story = {
  name: 'Load failed',
  /* 403, not 500: the response interceptor retries 429/500/502/503/504 with
     exponential backoff, so a 5xx never reaches the component within a story's
     lifetime and this assertion would time out against a working error path. */
  beforeEach: setup(routed(null, null, { subscription: 403, usage: 403 })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByText('Could not load your subscription. Please try again.')
      ).toBeInTheDocument()
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The plan grid is static copy, so it still renders - only the subscription-derived ' +
          'summary row is replaced by the error.',
      },
    },
  },
};
