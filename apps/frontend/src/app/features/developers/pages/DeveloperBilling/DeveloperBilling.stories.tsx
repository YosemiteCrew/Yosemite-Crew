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
  organisationId: 'org-storybook',
  plan,
  status,
  stripeSubscriptionItemId: plan === 'free' ? null : 'si_123',
  currentPeriodStart: plan === 'free' ? null : '2026-08-01T00:00:00.000Z',
  currentPeriodEnd: plan === 'free' ? null : '2026-09-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

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
  beforeEach: setup(() => ({ body: { data: subscription('free', 'active') } })),
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
  beforeEach: setup(() => ({ body: { data: subscription('pro', 'active') } })),
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
  beforeEach: setup(() => ({ body: { data: subscription('pro', 'past_due') } })),
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

export const LoadFailed: Story = {
  name: 'Load failed',
  /* 403, not 500: the response interceptor retries 429/500/502/503/504 with
     exponential backoff, so a 5xx never reaches the component within a story's
     lifetime and this assertion would time out against a working error path. */
  beforeEach: setup(() => ({ status: 403, body: { message: 'Insufficient scope' } })),
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
