import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { Invite } from '@/app/features/organization/types/team';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';

import Organizations from './Organizations';

const SUNRISE_ID = 'org-sunrise';
const MEADOW_ID = 'org-meadow';

const SUNRISE: Organisation = {
  _id: SUNRISE_ID,
  name: 'Sunrise Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+1 415 555 0134',
  taxId: 'TAX-0001',
  isVerified: true,
};

const MEADOW: Organisation = {
  _id: MEADOW_ID,
  name: 'Meadowbrook Boarding',
  type: 'BOARDER',
  phoneNo: '+1 415 555 0188',
  taxId: 'TAX-0002',
  isVerified: false,
};

const membership = (orgId: string, roleDisplay: string): UserOrganization => ({
  practitionerReference: 'Practitioner/pract-1',
  organizationReference: `Organization/${orgId}`,
  roleCode: 'VET',
  roleDisplay,
});

const HARBOUR_INVITE: Invite = {
  _id: 'invite-harbour',
  organisationId: 'org-harbour',
  organisationName: 'Harbour Animal Clinic',
  organisationType: 'HOSPITAL',
  invitedByUserId: 'user-owner',
  departmentId: 'dept-1',
  inviteeEmail: 'ravi.patel@example.com',
  role: 'VETERINARIAN',
  employmentType: 'FULL_TIME',
  token: 'token-harbour',
  status: 'PENDING',
  expiresAt: '2026-09-30T00:00:00.000Z',
  createdAt: '2026-08-20T09:00:00.000Z',
  updatedAt: '2026-08-20T09:00:00.000Z',
};

const INVITES_ENDPOINT = '/fhir/v1/organisation-invites/me/pending';

/** Held open on purpose: the only way to hold a loading frame still. */
const PENDING = 'pending' as const;
/** Answered with a 403, which is neither retried nor sent to SuperTokens. */
const REJECT = 'reject' as const;

type InvitesFixture = Invite[] | typeof PENDING | typeof REJECT;

type Scenario = {
  orgs?: Array<{ org: Organisation; roleDisplay: string }>;
  /** `loading` is the branch that swaps the whole page for the fullscreen loader. */
  orgStatus?: 'loading' | 'loaded';
  invites?: InvitesFixture;
  /**
   * Leave the accept POST unanswered. `handleAccept` flips `onAccepting` before
   * it awaits, so an unanswered request is what holds the accepting frame on
   * screen without dragging `loadOrgs` and the redirect resolver in behind it.
   */
  holdAccept?: boolean;
};

/**
 * This page is composed almost entirely of children that read global state, so
 * there is nothing to drive through props: the org rows come from `useOrgStore`
 * via `useOrgWithMemberships`, the greeting name from `useAuthStore`, and the
 * invites from a `loadInvites()` fired in a mount-only effect.
 *
 * The repo has no MSW, and `loadInvites` is a plain ESM export, so the axios
 * instance's adapter is the seam - the same one `FederationSection.stories`
 * uses. Store state and adapter are seeded together here so a story declares its
 * whole world in one `beforeEach`, and both are put back on unmount: `orgStore`
 * is persisted to localStorage, and the verify run loads every story in one
 * browser context, so a story that left orgs behind would silently seed its
 * neighbour.
 */
const scenario =
  ({ orgs = [], orgStatus = 'loaded', invites = [], holdAccept = false }: Scenario) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const authSnapshot = useAuthStore.getState();
    const originalAdapter = api.defaults.adapter;

    const orgsById: Record<string, Organisation> = {};
    const membershipsByOrgId: Record<string, UserOrganization> = {};
    const orgIds: string[] = [];
    for (const entry of orgs) {
      const id = String(entry.org._id);
      orgsById[id] = entry.org;
      membershipsByOrgId[id] = membership(id, entry.roleDisplay);
      orgIds.push(id);
    }

    useOrgStore.setState({
      orgsById,
      orgIds,
      membershipsByOrgId,
      // Not the first org: a member who reached the picker has not chosen yet,
      // and a non-null value would give one card the "current" blue tile.
      primaryOrgId: null,
      status: orgStatus,
    });
    // `ProtectedRoute` wraps this page. Only the status is set - no store action
    // runs, so nothing here reaches SuperTokens.
    useAuthStore.setState({
      status: 'authenticated',
      attributes: { sub: 'usr-story', given_name: 'Ravi' },
    });

    /* `getData` de-duplicates GETs still in flight, keyed on endpoint. A story
       that leaves one held open would otherwise hand its never-settling promise
       to the next story asking for the same endpoint. */
    clearInFlightGetRequests();

    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      const url = config.url ?? '';

      if (url === INVITES_ENDPOINT) {
        if (invites === PENDING) return new Promise<never>(() => {});
        if (invites === REJECT) {
          /* 403 rather than 401 or 5xx: a 401 sends the response interceptor
             into SuperTokens and a real sign-out redirect, and 5xx is on the
             transient retry list, so the page would sit on the inline loader
             through three backoffs before reaching the branch under test. */
          throw Object.assign(new Error('Request failed with status code 403'), {
            isAxiosError: true,
            config,
            response: {
              data: { message: 'Invites are unavailable' },
              status: 403,
              statusText: 'Forbidden',
              headers: {},
              config,
            },
          });
        }
        // `loadInvites` flattens `{ ...row.invite, ...row }`, which is the shape
        // the endpoint actually returns.
        return {
          data: invites.map((invite) => ({ invite })),
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      }

      if (holdAccept && url.endsWith('/accept')) return new Promise<never>(() => {});

      // Nothing else fires on this page. Answering rather than falling through
      // to the real adapter keeps a stray call off the network instead of
      // failing a story with an unrelated request error.
      return { data: [], status: 200, statusText: 'OK', headers: {}, config };
    }) as AxiosAdapter;

    return () => {
      api.defaults.adapter = originalAdapter;
      clearInFlightGetRequests();
      useOrgStore.setState(orgSnapshot);
      useAuthStore.setState(authSnapshot);
    };
  };

/**
 * A refused read is logged twice on its way to the empty fallback - once by
 * `getData`, once by `loadInvites` - and `storyqa-verify` treats any console
 * error as a broken story. Only those two lines are dropped; anything else still
 * reaches the console.
 */
const muteExpectedInviteFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some(
        (arg) =>
          typeof arg === 'string' &&
          (arg.includes('API getData error:') || arg.includes('Failed to load invites:'))
      );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const meta = {
  title: 'Organization/Organizations',
  component: Organizations,
  parameters: {
    layout: 'fullscreen',
    // `usePathname` in ProtectedRoute and `useRouter` in the page and in
    // OrganizationList all throw "invariant expected app router to be mounted"
    // without the App Router mock.
    nextjs: { appDirectory: true, navigation: { pathname: '/organizations' } },
    docs: {
      description: {
        component:
          'The org picker a member lands on after sign-in: greeting, the organisations they belong ' +
          'to, any pending invitations, and the create-organisation link. It owns three loading ' +
          'states none of its children can show - a fullscreen loader while the org store is ' +
          'loading, an inline loader while `loadInvites()` is in flight, and the fullscreen loader ' +
          'again while an invitation is being accepted. Stories seed the org and auth stores and ' +
          'swap the shared axios adapter, so nothing here touches the network.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Organizations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OrgsWithInvite: Story = {
  name: 'Two organisations, one invitation',
  beforeEach: scenario({
    orgs: [
      { org: SUNRISE, roleDisplay: 'veterinarian' },
      { org: MEADOW, roleDisplay: 'admin' },
    ],
    invites: [HARBOUR_INVITE],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The count is the member's ORGANISATIONS, not organisations plus pending
    // invitations. An invitation is not a place you belong to yet, and the two
    // lists sit next to each other, so summing them is the easy wrong change.
    await expect(await canvas.findByText('You belong to 2 organizations')).toBeInTheDocument();

    const orgRow = canvas.getByRole('button', { name: /Sunrise Veterinary/ });
    const accept = canvas.getByRole('button', { name: 'Accept' });
    const createLink = canvas.getByRole('link', { name: 'Create a new organization' });

    // Order is the page's whole job: organisations you already have, then the
    // ones asking for an answer, then the escape hatch. Both children return
    // null when empty, so a reorder here is invisible in their own stories.
    const following = globalThis.Node.DOCUMENT_POSITION_FOLLOWING;
    await expect(orgRow.compareDocumentPosition(accept) & following).toBeTruthy();
    await expect(accept.compareDocumentPosition(createLink) & following).toBeTruthy();

    // Neither loader survives a settled load.
    await expect(canvas.queryByTestId('organizations-loader')).toBeNull();
    await expect(canvas.queryByTestId('invites-loader')).toBeNull();
  },
};

export const InvitesLoading: Story = {
  name: 'Invitations still loading',
  beforeEach: scenario({
    orgs: [{ org: SUNRISE, roleDisplay: 'veterinarian' }],
    invites: PENDING,
  }),
  parameters: {
    docs: {
      description: {
        story:
          '`invitesLoading` starts true, so this is the first frame of every visit. The inline ' +
          'loader stands in for the invitation list ALONE - the organisations and the create link ' +
          'are already usable, which is the point of keeping this flag separate from the org ' +
          'status.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inline = await canvas.findByTestId('invites-loader');

    // The spinner is the only content in that slot, so without the live region a
    // screen reader is told nothing at all while it is up.
    await expect(inline).toHaveAttribute('aria-live', 'polite');

    // A pending invitations request must not hold the rest of the page back.
    await expect(canvas.getByRole('button', { name: /Sunrise Veterinary/ })).toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'Create a new organization' })
    ).toBeInTheDocument();
    await expect(canvas.queryByTestId('organizations-loader')).toBeNull();
  },
};

export const OrgStatusLoading: Story = {
  name: 'Organisations still loading',
  beforeEach: scenario({ orgStatus: 'loading', invites: [] }),
  parameters: {
    docs: {
      description: {
        story:
          'While the org store is loading the page renders nothing but the translucent fullscreen ' +
          'loader. It returns before the layout, so there is no greeting behind the blur to shift ' +
          'when the orgs land.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loader = await canvas.findByTestId('organizations-loader');
    await expect(loader).toHaveAttribute('aria-live', 'polite');

    // `fullscreen-translucent` is a fixed inset-0 overlay. Measured rather than
    // asserted on the class name, because passing the wrong variant string is a
    // silent downgrade to a 0-height inline spinner in the top-left corner.
    const box = loader.getBoundingClientRect();
    await expect(box.width).toBe(globalThis.window.innerWidth);
    await expect(box.height).toBe(globalThis.window.innerHeight);

    // The early return means the page itself is genuinely unmounted, not hidden.
    await expect(canvas.queryByText('Where are you working today?')).toBeNull();
    await expect(canvas.queryByRole('link', { name: 'Create a new organization' })).toBeNull();
  },
};

export const NoOrganizations: Story = {
  name: 'Belongs to nothing yet',
  beforeEach: scenario({ orgs: [], invites: [] }),
  parameters: {
    docs: {
      description: {
        story:
          'A brand-new member with no organisations and no invitations. Both lists return null ' +
          'rather than an empty state, so the greeting sits straight on top of the create link - ' +
          'the only thing there is to do here.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('You belong to 0 organizations')).toBeInTheDocument();

    // Nothing on this page is a button when both lists are empty: org rows and
    // the invite actions are the only ones, and the create card is a link. So a
    // stray empty-state row or placeholder card shows up here as a button.
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(
      canvas.getByRole('link', { name: 'Create a new organization' })
    ).toBeInTheDocument();
  },
};

export const AcceptingInvite: Story = {
  name: 'Accepting an invitation',
  beforeEach: scenario({
    orgs: [{ org: SUNRISE, roleDisplay: 'veterinarian' }],
    invites: [HARBOUR_INVITE],
    holdAccept: true,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Accept covers a request, an org reload and a route resolution before it navigates, and ' +
          'the org status dips to `loading` in the middle of it. The page therefore tracks the ' +
          'accept itself in `accepting` and shows the same fullscreen loader, so the picker cannot ' +
          'flash back between the two. The story holds the accept request open to keep that frame ' +
          'on screen.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const accept = await canvas.findByRole('button', { name: 'Accept' });
    await userEvent.click(accept);

    // `onAccepting` is passed from this page down into OrgInvites and back up
    // through a setState. Nothing else proves that wire: OrgInvites' own stories
    // pass a spy, and the loader lives here.
    await waitFor(async () => {
      await expect(canvas.getByTestId('organizations-loader')).toBeInTheDocument();
    });
    await expect(canvas.queryByRole('button', { name: 'Accept' })).toBeNull();
    await expect(canvas.queryByText('Where are you working today?')).toBeNull();
  },
};

export const InvitesRequestFailed: Story = {
  name: 'Invitations request refused',
  beforeEach: () => {
    const restoreLogs = muteExpectedInviteFailureLogs();
    const restoreScenario = scenario({
      orgs: [{ org: SUNRISE, roleDisplay: 'veterinarian' }],
      invites: REJECT,
    })();
    return () => {
      restoreScenario();
      restoreLogs();
    };
  },
  parameters: {
    docs: {
      description: {
        story:
          'A refused invitations read falls back to an empty list and clears the flag in a ' +
          '`finally`, so the picker settles instead of spinning forever. The member sees the same ' +
          'page as someone with no invitations, which is the right trade here - there is nothing ' +
          'they could do about it, and the organisations they do belong to still work.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The `finally` is what makes this pass. Dropped, the inline loader stays up
    // for the rest of the session and nothing else on the page reports a fault.
    await waitFor(async () => {
      await expect(canvas.queryByTestId('invites-loader')).toBeNull();
    });
    await expect(canvas.queryByRole('button', { name: 'Accept' })).toBeNull();

    // Singular, and the failed read did not disturb it.
    await expect(canvas.getByText('You belong to 1 organization')).toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'Create a new organization' })
    ).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: scenario({
    orgs: [
      { org: SUNRISE, roleDisplay: 'veterinarian' },
      {
        org: {
          ...MEADOW,
          name: 'Northern Highlands Veterinary Hospital and Emergency Referral Centre',
        },
        roleDisplay: 'senior consultant veterinary surgeon',
      },
    ],
    invites: [
      {
        ...HARBOUR_INVITE,
        organisationName: 'Harbour Animal Clinic and Rehabilitation Centre (Dockside)',
      },
    ],
  }),
  parameters: {
    docs: {
      description: {
        story:
          'The column is capped at 640px and drops to 12px side padding below `md`, so on a phone ' +
          'the rows are the full width of the screen. Organisation names are chosen by the ' +
          'practice, so this is where an unbounded one would push the picker sideways.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: /Sunrise Veterinary/ });

    // Names truncate rather than wrap, and the accept/decline pair is
    // `shrink-0`, so a name long enough to win the fight widens the page.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    // Accept and Decline stay on one line rather than the pair wrapping, which
    // is the first thing to give at 375. Compared on their centres, not their
    // tops: only Decline carries a border, so it is 2px taller and its top sits
    // 1px higher inside the `items-center` row even when nothing has wrapped.
    const accept = canvas.getByRole('button', { name: 'Accept' }).getBoundingClientRect();
    const decline = canvas.getByRole('button', { name: 'Decline' }).getBoundingClientRect();
    await expect(accept.top + accept.height / 2).toBeCloseTo(decline.top + decline.height / 2, 1);
  },
};
