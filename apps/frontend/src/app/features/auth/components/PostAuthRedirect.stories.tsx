import type { Meta, StoryObj } from '@storybook/react';
import { redirect } from '@storybook/nextjs-vite/navigation.mock';
import { expect, waitFor, within } from 'storybook/test';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';

import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import api from '@/app/services/axios';
import { useCounterStore } from '@/app/stores/counterStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import PostAuthRedirect from './PostAuthRedirect';

/**
 * `resolvePostAuthRedirect` returns `/developers/home` before any request when
 * the account holds the developer role AND the session was started from the
 * developer form (`devAuth` in sessionStorage). Pinned per story, and cleared
 * afterwards, because a leftover flag would send the practice story to the
 * portal.
 */
const withDeveloperDoor = (through: boolean) => () => {
  const previous = getStorageItem('session', 'devAuth');
  if (through) {
    setStorageItem('session', 'devAuth', 'true');
  } else {
    removeStorageItem('session', 'devAuth');
  }
  redirect.mockImplementation(() => undefined as never);
  return () => {
    if (previous === null) {
      removeStorageItem('session', 'devAuth');
    } else {
      setStorageItem('session', 'devAuth', previous);
    }
  };
};

const empty: AxiosAdapter = (config) => {
  const url = String(config.url ?? '');
  if (
    url.includes('/user-organization/user/mapping') ||
    url.includes('/organisation-invites/me/pending')
  ) {
    return Promise.resolve({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse);
  }
  return Promise.reject(
    new AxiosError(`Unstubbed request: ${url}`, 'ERR_BAD_REQUEST', config, undefined, {
      data: { message: 'Not Found' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config,
    } as AxiosResponse)
  );
};

/**
 * The practice path has to load the organisation list before it can decide,
 * and `loadOrgs` logs a console error on any failure - the preview's offline
 * 404 included. So the two GETs it makes for a brand-new account are answered
 * with empty lists, and the stores `loadOrgs` clears on that answer are
 * snapshotted and put back.
 */
const withNoOrganisations = () => {
  const restoreDoor = withDeveloperDoor(false)();
  const orgs = useOrgStore.getState();
  const counters = useCounterStore.getState().countersByOrgId;
  const subscriptions = useSubscriptionStore.getState().subscriptionByOrgId;
  const previousAdapter = api.defaults.adapter;
  api.defaults.adapter = empty;
  return () => {
    api.defaults.adapter = previousAdapter;
    useOrgStore.setState({
      orgsById: orgs.orgsById,
      orgIds: orgs.orgIds,
      primaryOrgId: orgs.primaryOrgId,
      membershipsByOrgId: orgs.membershipsByOrgId,
    });
    useCounterStore.setState({ countersByOrgId: counters });
    useSubscriptionStore.setState({ subscriptionByOrgId: subscriptions });
    restoreDoor();
  };
};

const meta = {
  title: 'Auth/PostAuthRedirect',
  component: PostAuthRedirect,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/auth/callback' } },
    docs: {
      description: {
        component:
          'The component a route renders when a session already exists and the only thing left ' +
          'to do is leave. It paints nothing. In an effect it asks `resolvePostAuthRedirect` ' +
          'where this account belongs - the developer portal for a developer who came through ' +
          'the developer door, `/organizations` for pending invites or no primary org, ' +
          '`/create-org` for a brand-new practice account, the org onboarding wizard for an ' +
          'unverified org, `/team-onboarding` for an incomplete profile, and otherwise the ' +
          "role's default screen - then calls `redirect()` during render so Next's redirect " +
          'boundary performs the replace and no wrong route is ever shown.\n\n' +
          "Because the App Router mock's `redirect()` throws (as the real one does), these " +
          'stories re-implement it as a recorder for their own run and assert the route it was ' +
          'handed. The panel around the component is the harness, not the component: the ' +
          "component's own output is the empty slot inside it.",
      },
    },
  },
  tags: ['autodocs'],
  render: (args) => (
    <div
      style={{
        display: 'grid',
        gap: 10,
        maxWidth: 520,
        padding: 24,
        border: '1px solid var(--hairline)',
        borderRadius: 20,
        background: 'var(--screen)',
      }}
    >
      <output style={{ fontSize: 14, color: 'var(--ink-muted)' }}>
        Finishing sign-in. The component renders nothing while it resolves the destination.
      </output>
      <div data-testid="redirect-slot">
        <PostAuthRedirect {...args} />
      </div>
    </div>
  ),
} satisfies Meta<typeof PostAuthRedirect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeveloperDoor: Story = {
  name: 'Developer, through the developer door',
  args: { fallbackRole: 'developer' },
  beforeEach: withDeveloperDoor(true),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('redirect-slot').childElementCount).toBe(0);
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/developers/home'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The short-circuit: the role is `developer` and `devAuth` is set, so the destination is ' +
          'the portal and no organisation is loaded. This is the one path that is decided ' +
          'without a request.',
      },
    },
  },
};

export const NewPracticeAccount: Story = {
  name: 'New practice account (no organisation yet)',
  args: { fallbackRole: 'owner' },
  beforeEach: withNoOrganisations,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('redirect-slot').childElementCount).toBe(0);
    // Mapping came back empty, invites came back empty: create an organisation.
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/create-org'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'An owner who just verified their email. The organisation mapping is empty and there ' +
          'are no pending invites (both answered from a stubbed adapter), so the resolver sends ' +
          'them to create their first organisation rather than to a dashboard they cannot have.',
      },
    },
  },
};
