import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import DeveloperApiKeys from './DeveloperApiKeys';

/**
 * These stories drive the real component against the real service layer, with
 * only the axios ADAPTER swapped. That is deliberate: stubbing the adapter
 * leaves the request/response interceptors, the org-header attachment and the
 * `{ data: ... }` envelope unwrapping in the path, so a story fails if any of
 * those change - which stubbing the service module would hide.
 *
 * `clearInFlightGetRequests()` matters between stories: `getData` de-duplicates
 * concurrent GETs by URL, so without it the second story to request
 * `/v1/developers/api-keys` can be handed the first story's promise.
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
    return {
      data: body,
      status,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
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

/** Seeds auth + a stubbed API, and restores both on unmount. */
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

const KEYS = [
  {
    id: 'k-live',
    name: 'Production server',
    prefix: 'yc_live_4hTe',
    last4: '9x2m',
    scopes: ['appointments:read', 'patients:read'],
    environment: 'live' as const,
    status: 'active' as const,
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
    environment: 'test' as const,
    status: 'active' as const,
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-08-23T14:30:00.000Z',
  },
  {
    id: 'k-revoked',
    name: 'Legacy import script',
    prefix: 'yc_live_1bYz',
    last4: '44qp',
    scopes: ['patients:read'],
    environment: 'live' as const,
    status: 'revoked' as const,
    lastUsedAt: '2026-04-18T11:00:00.000Z',
    expiresAt: null,
    revokedAt: '2026-04-18T12:00:00.000Z',
    createdAt: '2026-02-04T10:00:00.000Z',
  },
];

const meta = {
  title: 'Developers/DeveloperApiKeys',
  component: DeveloperApiKeys,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/api-keys' } },
    docs: {
      description: {
        component:
          'Key management for the developer portal: list, create, revoke.\n\n' +
          'The security-critical moment is **creation**. The plaintext key exists in the UI ' +
          'exactly once - the backend stores only a SHA-256 hash - so the reveal is rendered on ' +
          'the portal’s dark "spot" card rather than as another bone row, and it does not ' +
          'reappear after "Done". The list only ever shows `prefix…last4`.\n\n' +
          'Revoke is offered per row and only while a key is `active`; a revoked key keeps its ' +
          'row so the audit trail stays visible.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: setup(() => ({ body: { data: KEYS } })),
} satisfies Meta<typeof DeveloperApiKeys>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithKeys: Story = {
  name: 'Keys listed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => expect(canvas.getByText('Production server')).toBeInTheDocument());
    await expect(canvas.getByText('Claude Code · laptop')).toBeInTheDocument();
    await expect(canvas.getByText('Legacy import script')).toBeInTheDocument();

    /* Masked, never plaintext: the list renders `prefix…last4` and the full key
       is not recoverable from this screen at all. */
    await expect(canvas.getByText('yc_live_4hTe…9x2m')).toBeInTheDocument();

    /* Revoke is per-row and gated on status, so two active keys give two
       buttons - the revoked row must not offer one. */
    await expect(canvas.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two active keys and one revoked. The revoked row stays in the table without a Revoke ' +
          'button - removing it would erase the record that the key ever existed.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No keys yet',
  beforeEach: setup(() => ({ body: { data: [] } })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('api-keys-empty')).toBeInTheDocument());
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create API key' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state every new developer lands in. The table is absent rather than empty, so the ' +
          'only affordance is the create button.',
      },
    },
  },
};

export const CreateAndReveal: Story = {
  name: 'Create a key (one-time reveal)',
  beforeEach: setup((config) => {
    if (config.method?.toLowerCase() === 'post') {
      return {
        status: 201,
        body: {
          id: 'k-new',
          name: 'CI runner',
          prefix: 'yc_test_EXAM',
          last4: '0000',
          scopes: [],
          environment: 'test',
          /* Deliberately low-entropy and self-evidently fake. A realistic-looking
             random key here trips the repo's gitleaks `generic-api-key` rule
             (entropy > 3.7) and fails the secret scan on every push. */
          apiKey: 'yc_test_EXAMPLE0000EXAMPLE0000EXAMPLE0000',
        },
      };
    }
    return { body: { data: KEYS } };
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole('button', { name: 'Create API key' }));
    await userEvent.type(canvas.getByLabelText('Key name'), 'CI runner');
    await userEvent.selectOptions(canvas.getByLabelText('Environment'), 'test');
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));

    /* The whole point of the screen: the plaintext secret is shown once, in
       full, and this is the only render in which it exists. */
    const secret = await canvas.findByTestId('issued-secret');
    await expect(secret).toHaveTextContent('yc_test_EXAMPLE0000EXAMPLE0000EXAMPLE0000');
    await expect(canvas.getByRole('button', { name: 'Copy' })).toBeInTheDocument();

    // The form closes on success, so the reveal is not competing with it.
    await expect(canvas.queryByLabelText('Key name')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'After creation the banner carries the full key and a copy control. Dismissing it with ' +
          '"Done" is irreversible - nothing in the UI can show that value again, which is why ' +
          'the copy affordance sits next to the secret rather than in a menu.',
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
        canvas.getByText('Could not load your API keys. Please try again.')
      ).toBeInTheDocument()
    );
    /* An error replaces the list rather than sitting above a stale one, so a
       failed refresh never leaves keys on screen that may no longer be valid. */
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The message is deliberately non-specific: the endpoint returns the same 401 for an ' +
          'unknown, revoked or expired key, and the UI does not invent a distinction the API ' +
          'refuses to make.',
      },
    },
  },
};
