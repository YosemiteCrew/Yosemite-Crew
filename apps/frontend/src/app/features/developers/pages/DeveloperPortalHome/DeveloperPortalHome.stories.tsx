import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { expect, waitFor, within } from 'storybook/test';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type { DeveloperApiKey } from '@/app/services/developerApiKeys';
import type { DeveloperUsage } from '@/app/services/developerUsage';
import { useAuthStore } from '@/app/stores/authStore';
import DeveloperPortalHome from './DeveloperPortalHome';

const KEYS: DeveloperApiKey[] = [
  {
    id: 'k-live',
    name: 'Production server',
    prefix: 'yc_live_4hTe',
    last4: '9x2m',
    scopes: ['appointments:read', 'patients:read'],
    environment: 'live',
    status: 'active',
    lastUsedAt: '2026-08-26T08:12:00.000Z',
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-05-12T09:00:00.000Z',
  },
  {
    id: 'k-test',
    name: 'Claude Code · laptop',
    prefix: 'yc_test_9f2K',
    last4: 'D41x',
    scopes: ['appointments:read'],
    environment: 'test',
    status: 'active',
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-08-23T14:30:00.000Z',
  },
  {
    // Revoked keys are listed by the API but do not count as active here.
    id: 'k-revoked',
    name: 'Legacy import script',
    prefix: 'yc_live_1bYz',
    last4: '44qp',
    scopes: ['patients:read'],
    environment: 'live',
    status: 'revoked',
    lastUsedAt: '2026-04-18T11:00:00.000Z',
    expiresAt: null,
    revokedAt: '2026-04-18T12:00:00.000Z',
    createdAt: '2026-02-04T10:00:00.000Z',
  },
];

const USAGE: DeveloperUsage = { billingPeriod: '2026-08', callCount: 4218, limit: 100_000 };

type Handler = (config: InternalAxiosRequestConfig) => { status?: number; body?: unknown };

/**
 * As with the API-keys and Billing stories, only the axios ADAPTER is swapped
 * so the real services, interceptors and `{ data: ... }` envelope stay in the
 * path. `clearInFlightGetRequests()` matters between stories: `getData`
 * de-duplicates concurrent GETs by URL, so without it a later story can be
 * handed an earlier story's promise.
 */
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

/** Routes on the URL: the two status figures come from two different endpoints. */
const routed =
  (keys: DeveloperApiKey[] | null, usage: DeveloperUsage | null): Handler =>
  (config) => {
    const url = config.url ?? '';
    if (url.includes('/usage')) {
      return usage ? { body: { data: usage } } : { status: 403, body: {} };
    }
    return keys ? { body: { data: keys } } : { status: 403, body: {} };
  };

type Seed = {
  role?: string;
  givenName?: string;
  familyName?: string;
};

const seedAccount = ({
  role = 'developer',
  givenName = 'Ravi',
  familyName = 'Patel',
}: Seed = {}) => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({
    status: 'authenticated',
    role,
    roles: undefined,
    user: {
      userId: 'dev-storybook',
      email: 'ravi@example.test',
      authProfile: null,
      loginMethod: 'emailpassword',
      emailVerified: true,
      getUsername: () => 'dev-storybook',
    },
    attributes: {
      sub: 'dev-storybook',
      email: 'ravi@example.test',
      email_verified: 'true',
      given_name: givenName,
      family_name: familyName,
    },
  });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

const setup =
  (handler: Handler, seed: Seed = {}) =>
  () => {
    clearInFlightGetRequests();
    const restoreAuth = seedAccount(seed);
    const restoreApi = stubApi(handler);
    return () => {
      restoreApi();
      restoreAuth();
      clearInFlightGetRequests();
    };
  };

/**
 * The status card logs each figure it cannot read through `logger.error`,
 * which is `console.error` in the preview, and the render check treats a
 * console error as a broken story. Only those two lines are dropped.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args.some(
      (arg) =>
        typeof arg === 'string' &&
        (arg.includes('Failed to load developer API') || arg.includes('API getData error'))
    );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

/**
 * The phone layout asks openstatus.dev for the platform status on mount, so
 * the phone story swaps `fetch` the way PhoneDevHome.stories does and puts the
 * real one back on unmount.
 */
const withPlatformStatus = (status: string) => () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('openstatus.dev')) {
      return Promise.resolve(
        new Response(JSON.stringify({ status }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = original;
  };
};

/** The value opposite a status label in the Quick status card. */
const statusValue = (canvasElement: HTMLElement, label: string) =>
  within(canvasElement).getByText(label).nextElementSibling?.textContent?.trim() ?? '';

const meta = {
  title: 'Developers/DeveloperPortalHome',
  component: DeveloperPortalHome,
  parameters: {
    layout: 'fullscreen',
    // DevRouteGuard only guards paths under /developers; NotADeveloperState uses the router.
    nextjs: { appDirectory: true, navigation: { pathname: '/developers' } },
    docs: {
      description: {
        component:
          'The developer portal home: a greeting, the FHIR-native hero with its Quick status ' +
          'card, and two resource cards.\n\n' +
          'The two numbers on the status card are read, not asserted. They used to be ' +
          'literals on a portal where the Billing page next door read the same account and ' +
          'correctly showed 0; now they come from the same endpoints Billing and API Keys use, ' +
          'settle independently, and show a dash when they cannot be read. Only `active` keys ' +
          'are counted - a revoked key stays in the list but not in the figure - and the ' +
          '"Your API keys" card changes its copy and its action when the count is zero.\n\n' +
          'The route sits behind `DevRouteGuard`. A signed-in account without the developer ' +
          'role is shown a terminal "not a developer account" state rather than being signed ' +
          'out or bounced to a sign-in that would fail the same way. Below 768px the whole ' +
          'page swaps for `PhoneDevHome`, which has its own stories.\n\n' +
          'The stories seed the auth store and answer both endpoints from the shared axios ' +
          'adapter; the phone story also stubs the openstatus fetch the phone layout makes.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: setup(routed(KEYS, USAGE)),
} satisfies Meta<typeof DeveloperPortalHome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  name: 'Keys and usage loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Ravi Patel')).toBeVisible();
    await expect(canvas.getByText('Welcome back,')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Quick status' })).toBeVisible();

    // Two active out of three listed: the revoked key does not count.
    await waitFor(() => expect(statusValue(canvasElement, 'Active API keys')).toBe('2'));
    await expect(statusValue(canvasElement, 'API calls this period')).toBe('4,218');
    await expect(statusValue(canvasElement, 'Portal access')).toBe('Active');

    // With keys, the card offers management rather than creation.
    await expect(canvas.getByRole('link', { name: /Manage API keys/ })).toHaveAttribute(
      'href',
      '/developers/api-keys'
    );
    await expect(canvas.getByRole('link', { name: 'View docs' })).toHaveAttribute(
      'href',
      '/developers/documentation'
    );
    // The external link opens in a new tab, and only it does.
    /* Exact label, not a regex: `label` is the literal string
       'github.com/YosemiteCrew', so an exact matcher pins it more tightly, and
       an unanchored host-shaped pattern is what CodeQL's
       js/regex/missing-regexp-anchor rule flags (it cannot tell an accessible-name
       matcher from URL validation). */
    await expect(canvas.getByRole('link', { name: 'github.com/YosemiteCrew' })).toHaveAttribute(
      'target',
      '_blank'
    );
  },
};

export const NoKeysYet: Story = {
  name: 'No API keys yet',
  beforeEach: setup(routed([], { ...USAGE, callCount: 0 })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Ravi Patel');
    await waitFor(() => expect(statusValue(canvasElement, 'Active API keys')).toBe('0'));
    await expect(statusValue(canvasElement, 'API calls this period')).toBe('0');
    // Zero keys flips the card's copy AND its action.
    await expect(
      canvas.getByText('You have no active keys yet. Create one to authenticate an integration.')
    ).toBeVisible();
    await expect(canvas.getAllByRole('link', { name: /Create an API key/ }).length).toBeGreaterThan(
      0
    );
    await expect(canvas.queryByRole('link', { name: /Manage API keys/ })).not.toBeInTheDocument();
  },
};

export const StatusUnavailable: Story = {
  name: 'Status endpoints refused',
  beforeEach: [setup(routed(null, null)), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Ravi Patel');
    // A dash, never an invented figure - and the rest of the page is untouched.
    await waitFor(() => expect(statusValue(canvasElement, 'Active API keys')).toBe('—'));
    await expect(statusValue(canvasElement, 'API calls this period')).toBe('—');
    await expect(canvas.getByRole('heading', { name: 'Quick links' })).toBeVisible();
    // Unknown is not zero: the keys card keeps its neutral copy.
    await expect(canvas.getByRole('link', { name: /Manage API keys/ })).toBeVisible();
  },
};

export const EmailFallbackName: Story = {
  name: 'No name on the account',
  beforeEach: setup(routed(KEYS, USAGE), { givenName: '', familyName: '' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The greeting falls back to the email before it falls back to "Developer".
    await expect(await canvas.findByText('ravi@example.test')).toBeVisible();
  },
};

export const NotADeveloper: Story = {
  name: 'Signed in without the developer role',
  beforeEach: setup(routed(KEYS, USAGE), { role: 'member' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("This isn't a developer account")).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Create a developer account' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Back to Yosemite Crew' })).toBeVisible();
    // The portal itself is never mounted behind the notice.
    await expect(canvas.queryByText('Welcome back,')).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: hands off to PhoneDevHome',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: [setup(routed(KEYS, USAGE)), withPlatformStatus('operational')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('All systems operational')).toBeVisible();
    await expect(canvas.getByText(/Ravi Patel/)).toBeVisible();
    // The desktop hero is not merely hidden; the phone layout replaces it.
    await expect(canvas.queryByRole('heading', { name: 'Quick status' })).not.toBeInTheDocument();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
