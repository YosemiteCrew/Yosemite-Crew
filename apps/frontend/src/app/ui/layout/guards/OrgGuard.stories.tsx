import type { Meta, StoryObj } from '@storybook/react';
import { redirect } from '@storybook/nextjs-vite/navigation.mock';
import { expect, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useCounterStore } from '@/app/stores/counterStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import OrgGuard from './OrgGuard';

const ORG_ID = 'org-guard-story';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '+49 30 1234567',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
  address: {
    addressLine: '18 Kastanienallee',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10435',
    country: 'Germany',
  },
};

const OWNER_MEMBERSHIP: UserOrganization = {
  id: 'membership-org-guard-story',
  practitionerReference: 'Practitioner/practitioner-elena',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

/**
 * An Admin with `integrations:view:any` taken back off. `resolveMembershipPermissions`
 * derives the effective set from `roleCode` + `revokedPermissions`, never from a
 * stored `effectivePermissions` snapshot, so the revocation is the whole story.
 */
const ADMIN_MEMBERSHIP_NO_INTEGRATIONS: UserOrganization = {
  id: 'membership-org-guard-story-admin',
  practitionerReference: 'Practitioner/practitioner-ravi',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'ADMIN',
  roleDisplay: 'Admin',
  active: true,
  revokedPermissions: [PERMISSIONS.INTEGRATIONS_VIEW_ANY],
};

/**
 * Every field here is read by `computeTeamOnboardingStep`. Drop one and the
 * profile step falls below 3, at which point the guard redirects to
 * `/team-onboarding` before it ever reaches the branch a story wants to show.
 * `pmsPreferences.defaultOpenScreen` also pins the "already home" landing
 * check for `/dashboard` - without it the guard resolves the preferred
 * landing from localStorage and can bounce the Allowed story off its own URL.
 */
const PROFILE: UserProfile = {
  _id: 'profile-org-guard-story',
  userId: 'practitioner-elena',
  organizationId: ORG_ID,
  status: 'COMPLETED',
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1988-04-12',
    phoneNumber: '+49 30 7654321',
    address: {
      addressLine: '18 Kastanienallee',
      city: 'Berlin',
      state: 'Berlin',
      postalCode: '10435',
      country: 'Germany',
    },
    pmsPreferences: { defaultOpenScreen: 'DASHBOARD' },
  },
  professionalDetails: {
    qualification: 'DVM',
    yearsOfExperience: 11,
    specialization: 'Internal medicine',
  },
};

/** One published day is enough for `computeTeamOnboardingStep` to reach step 3. */
const AVAILABILITY: ApiDayAvailability[] = [
  {
    _id: 'availability-monday',
    organisationId: ORG_ID,
    dayOfWeek: 'monday',
    slots: [{ startTime: '09:00', endTime: '17:00', isAvailable: true }],
  },
];

/**
 * Every store the guard's eleven `useLoad*ForPrimaryOrg` hooks and
 * `useInventoryModule` read from, snapshotted as a group so a seeded
 * organisation cannot leak into the next story. Zustand `setState` merges, so
 * writing the whole previous state back restores both data and actions.
 */
type SnapshotableStore = {
  getState: () => unknown;
  setState: (partial: never) => void;
};

const SEEDED_STORES: SnapshotableStore[] = [
  useAppointmentStore,
  useAvailabilityStore,
  useCompanionStore,
  useCounterStore,
  useFormsStore,
  useIntegrationStore,
  useInventoryStore,
  useInvoiceStore,
  useOrgStore,
  useOrganisationRoomStore,
  useOrganizationDocumentStore,
  useSpecialityStore,
  useSubscriptionStore,
  useTaskStore,
  useTeamStore,
  useUserProfileStore,
];

/**
 * Offline transport for the one loader with no "already have this org" guard:
 * `useLoadSubscriptionCounterForPrimaryOrg` calls `checkStatus` unconditionally
 * whenever a primary org is set. Left alone it hits the wire, the Storybook
 * offline guard answers 404, and `checkStatus`'s own `catch` logs through
 * `console.error` before rethrowing - a console error the story verifier
 * counts as a failure. Axios picks the XHR adapter in the browser, so swapping
 * `XMLHttpRequest` is the seam that needs no module mocking (same technique
 * `Dashboard.stories.tsx` uses for the same hook).
 */
class OfflineXhr {
  status = 200;
  statusText = 'OK';
  responseText = '[]';
  response = '[]';
  responseURL = '';
  readyState = 4;
  timeout = 0;
  withCredentials = false;
  responseType = '';
  onloadend: (() => void) | null = null;
  open = () => undefined;
  setRequestHeader = () => undefined;
  getAllResponseHeaders = () => 'content-type: application/json\r\n';
  abort = () => undefined;
  send = () => {
    setTimeout(() => this.onloadend?.(), 0);
  };
}

type Seed = {
  /** false leaves the org store at its untouched default: no org, status 'idle'. */
  withOrg?: boolean;
  membership?: UserOrganization;
  orgStatus?: 'idle' | 'loading' | 'loaded' | 'error';
};

const seedOrgGuard = ({
  withOrg = true,
  membership = OWNER_MEMBERSHIP,
  orgStatus = 'loaded',
}: Seed) => {
  const originalXhr = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = OfflineXhr as unknown as typeof XMLHttpRequest;

  const snapshots = SEEDED_STORES.map((store) => [store, store.getState()] as const);

  // The cached-pass sessionStorage flag is keyed by org id and read on mount
  // for any route that declares no permission requirement (and, with no
  // primary org yet, scanned across every org). A pass recorded by an earlier
  // story in this file would otherwise let a later "loading" or "no org"
  // story start already `checked`.
  globalThis.sessionStorage?.clear();

  useOrgStore.setState({
    orgsById: withOrg ? { [ORG_ID]: ORG } : {},
    orgIds: withOrg ? [ORG_ID] : [],
    primaryOrgId: withOrg ? ORG_ID : null,
    membershipsByOrgId: withOrg ? { [ORG_ID]: membership } : {},
    status: orgStatus,
  });

  useUserProfileStore.setState({ profilesByOrgId: { [ORG_ID]: PROFILE }, status: 'loaded' });
  useAvailabilityStore.getState().setAvailabilitiesForOrg(ORG_ID, AVAILABILITY);
  useTeamStore.getState().setTeamsForOrg(ORG_ID, []);

  /* An empty list still counts as "loaded for this org": every one of these
     loaders tests for the KEY, not for rows, so seeding empty lists is what
     keeps ten of the eleven `useLoad*ForPrimaryOrg` hooks off the network. */
  useOrganisationRoomStore.setState({ roomIdsByOrgId: { [ORG_ID]: [] } });
  useCompanionStore.setState({ companionsIdsByOrgId: { [ORG_ID]: [] } });
  useAppointmentStore.setState({ appointmentIdsByOrgId: { [ORG_ID]: [] } });
  useOrganizationDocumentStore.setState({ documentIdsByOrgId: { [ORG_ID]: [] } });
  useInvoiceStore.setState({ invoiceIdsByOrgId: { [ORG_ID]: [] } });
  useIntegrationStore.setState({ integrationIdsByOrgId: { [ORG_ID]: [] } });
  useSpecialityStore.setState({ specialityIdsByOrgId: { [ORG_ID]: [] } });
  useTaskStore.setState({ taskIdsByOrgId: { [ORG_ID]: [] } });
  useFormsStore.setState({ lastFetchedByOrgId: { [ORG_ID]: '2026-08-19T00:00:00.000Z' } });
  /* The inventory module is the one loader keyed on a timestamp rather than on
     the presence of the org. */
  useInventoryStore.setState({
    itemIdsByOrgId: { [ORG_ID]: [] },
    statusByOrgId: { [ORG_ID]: 'loaded' },
    lastFetchedByOrgId: { [ORG_ID]: '2026-08-19T00:00:00.000Z' },
  });

  redirect.mockImplementation(() => undefined as never);

  return () => {
    globalThis.XMLHttpRequest = originalXhr;
    globalThis.sessionStorage?.clear();
    for (const [store, state] of snapshots) {
      store.setState(state as never);
    }
  };
};

const withOrgGuard =
  (seed: Seed = {}) =>
  () =>
    seedOrgGuard(seed);

const SETTLE = { timeout: 10_000 };

const meta = {
  title: 'Layout/Guards/OrgGuard',
  component: OrgGuard,
  parameters: {
    layout: 'padded',
    // OrgGuard reads `usePathname()` and calls the App Router's `redirect()`.
    nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } },
    docs: {
      description: {
        component:
          'The guard every org-scoped route renders through. It fires eleven ' +
          '`useLoad*ForPrimaryOrg` data hooks unconditionally, then reads `orgStore`, ' +
          '`availabilityStore`, `teamStore` and `profileStore` to decide one of three ' +
          'outcomes: hold the route on its `skeleton` while an org is still resolving, ' +
          'redirect (onboarding incomplete, membership deactivated, no primary org, or the ' +
          'current path needs a permission the membership lacks), or render `children`. A ' +
          'passed check is cached per organisation in `sessionStorage` and skipped entirely ' +
          'for any path that declares no permission requirement.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    children: <div data-testid="org-guard-children">Protected route content</div>,
  },
  argTypes: {
    children: { table: { disable: true } },
    skeleton: { table: { disable: true } },
  },
  beforeEach: withOrgGuard(),
} satisfies Meta<typeof OrgGuard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Organisation still resolving (skeleton)',
  beforeEach: withOrgGuard({ orgStatus: 'loading' }),
  args: {
    skeleton: <div data-testid="org-guard-skeleton">Loading organisation…</div>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `orgStore.status: 'loading'` is a PENDING status, so the guard has not
    // decided anything yet: no redirect, no children, just the skeleton.
    await expect(canvas.getByTestId('org-guard-skeleton')).toBeInTheDocument();
    await expect(canvas.queryByTestId('org-guard-children')).not.toBeInTheDocument();
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'While `orgStore.status` is `idle` or `loading`, `isStatusPending` holds the guard ' +
          "open: it renders the caller's `skeleton` (nothing, by default) rather than guessing " +
          'at a redirect or mounting children against data that has not arrived yet.',
      },
    },
  },
};

export const Allowed: Story = {
  name: 'Owner, verified org, onboarding done (renders children)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByTestId('org-guard-children')).toBeInTheDocument();
    }, SETTLE);
    await expect(canvas.getByText('Protected route content')).toBeInTheDocument();
    await expect(redirect).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday case: a verified organisation, an owner membership, a completed ' +
          'profile and a published availability slot. Every onboarding gate clears, the ' +
          "current path (`/dashboard`) is already the owner's preferred landing screen, and " +
          'the guard renders its children.',
      },
    },
  },
};

export const PermissionDenied: Story = {
  name: 'Membership lacks the route permission (redirects)',
  beforeEach: withOrgGuard({ membership: ADMIN_MEMBERSHIP_NO_INTEGRATIONS }),
  parameters: {
    // Not /dashboard: that route requires analytics:view:any, which would
    // redirect this membership for an unrelated reason before the
    // integrations check below is ever reached.
    nextjs: { appDirectory: true, navigation: { pathname: '/integrations' } },
    docs: {
      description: {
        story:
          'An Admin membership with `integrations:view:any` explicitly revoked, on ' +
          '`/integrations`. `resolveMembershipPermissions` derives the effective set from the ' +
          'role table plus revocations - never from a stored snapshot - so the guard redirects ' +
          "to the membership's first accessible route rather than rendering a page it has no " +
          'access to.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The Admin baseline grants integrations:view:any; this membership has had
    // it revoked, so /integrations is unreachable and the guard bounces it to
    // the first route its remaining permissions DO cover.
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/dashboard'), SETTLE);
    // `redirect()` throws in the app; the mock does not, so the render
    // continues past it - the guard has nothing to show for a route it just
    // redirected away from, and children never mount.
    await expect(canvas.queryByTestId('org-guard-children')).not.toBeInTheDocument();
  },
};

export const OrgFetchFailed: Story = {
  name: 'Organisation fetch failed (redirects, does not hang)',
  beforeEach: withOrgGuard({ withOrg: false, orgStatus: 'error' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `isStatusPending` recognises only 'idle' and 'loading'. An 'error'
    // status is deliberately treated as SETTLED, not pending - the guard
    // proceeds to its "no primary org" fallback instead of holding the
    // skeleton open forever on a request that already failed.
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/organizations'), SETTLE);
    await expect(canvas.queryByTestId('org-guard-children')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "`orgStore.status: 'error'` - the organisation list failed to load. Contrast this " +
          "with the Loading story: a 'loading' status holds the skeleton open indefinitely, " +
          "while 'error' is treated as resolved and the guard falls back to `/organizations` " +
          'immediately rather than stranding the visitor on a spinner for a request that is ' +
          'never going to arrive.',
      },
    },
  },
};
