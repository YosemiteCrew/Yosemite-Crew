import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { Appointment, Organisation, UserOrganization } from '@yosemite-crew/types';

import type { ApiDayAvailability } from '../../appointments/components/Availability/utils';
import type { BillingCounter, BillingSubscription } from '../../billing/types/billing';
import type { Team } from '../../organization/types/team';
import type { Task } from '../../tasks/types/task';
import type { UserProfile } from '../../users/types/profile';
import { PERMISSIONS } from '../../../lib/permissions';
import { useAppointmentStore } from '../../../stores/appointmentStore';
import { useAuthStore } from '../../../stores/authStore';
import { useAvailabilityStore } from '../../../stores/availabilityStore';
import { useCompanionStore } from '../../../stores/companionStore';
import { useCounterStore } from '../../../stores/counterStore';
import { useOrganizationDocumentStore } from '../../../stores/documentStore';
import { useFormsStore } from '../../../stores/formsStore';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { useInventoryStore } from '../../../stores/inventoryStore';
import { useInvoiceStore } from '../../../stores/invoiceStore';
import { useOrgStore } from '../../../stores/orgStore';
import { useUserProfileStore } from '../../../stores/profileStore';
import { useOrganisationRoomStore } from '../../../stores/roomStore';
import { useSpecialityStore } from '../../../stores/specialityStore';
import { useSubscriptionStore } from '../../../stores/subscriptionStore';
import { useTaskStore } from '../../../stores/taskStore';
import { useTeamStore } from '../../../stores/teamStore';
import ProtectedDashboard from './Dashboard';

const ORG_ID = 'org-dashboard-story';
const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';

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

/**
 * An owner membership. `usePermissions` recomputes the effective set from
 * `roleCode` against the role table rather than reading the stored
 * `effectivePermissions` snapshot, so seeding the role is the whole grant - and
 * `revokedPermissions` is the only lever that takes one back off.
 *
 * `roleDisplay` is load-bearing twice: OrgGuard's owner branch keys off
 * `role.toLowerCase() === 'owner'`, and the permission notice quotes the same
 * string back at the reader.
 */
const buildMembership = (revoked: string[] = []): UserOrganization => ({
  id: 'membership-dashboard-story',
  practitionerReference: `Practitioner/${ELENA}`,
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

/**
 * Every field here is checked by `computeTeamOnboardingStep`. Drop one and the
 * profile step falls below 3, at which point OrgGuard redirects the owner to
 * /team-onboarding and the story renders nothing at all.
 *
 * `pmsPreferences.defaultOpenScreen` pins the landing route too: without it the
 * guard resolves the preferred landing from localStorage, so a leftover
 * "/appointments" from another story would bounce this one off /dashboard.
 */
const PROFILE: UserProfile = {
  _id: 'profile-dashboard-story',
  userId: ELENA,
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

/** One published day is enough for the third onboarding step to count as done. */
const AVAILABILITY: ApiDayAvailability[] = [
  {
    _id: 'availability-monday',
    organisationId: ORG_ID,
    dayOfWeek: 'monday',
    slots: [{ startTime: '09:00', endTime: '17:00', isAvailable: true }],
  },
];

const member = (id: string, name: string, role: string, status: Team['status']): Team => ({
  _id: id,
  practionerId: id,
  organisationId: ORG_ID,
  name,
  role,
  speciality: [],
  todayAppointment: '6',
  weeklyWorkingHours: '38.5',
  status,
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAM: Team[] = [
  member(ELENA, 'Dr. Elena Marsh', 'VETERINARIAN', 'Available'),
  member(RAVI, 'Dr. Ravi Patel', 'VETERINARIAN', 'Consulting'),
];

const appointment = (id: string, companionName: string, parent: string): Appointment => {
  const patient: Appointment['patient'] = {
    id: `companion-${id}`,
    name: companionName,
    species: 'Dog',
    breed: 'Beagle',
    parent: { id: `parent-${id}`, name: parent },
  };
  /* Local-time constructors, not UTC literals: the schedule table reads local
     hours off these dates, so an ISO Z string slides the row by the runner's
     offset and the story would pass or fail by timezone. */
  const start = new Date(2026, 7, 19, 9, 30);
  return {
    id,
    organisationId: ORG_ID,
    patient,
    companion: patient,
    appointmentType: {
      id: 'svc-annual',
      name: 'Annual check-up',
      speciality: { id: 'spec-general', name: 'General practice' },
    },
    appointmentDate: start,
    startTime: start,
    endTime: new Date(2026, 7, 19, 10, 0),
    timeSlot: '09:30 AM',
    durationMinutes: 30,
    status: 'UPCOMING',
    concern: 'Annual boosters and a weight check.',
  };
};

const APPOINTMENTS: Appointment[] = [
  appointment('appointment-1', 'Kizie', 'Sky Doe'),
  appointment('appointment-2', 'Bailey', 'Marta Lang'),
];

const TASKS: Task[] = [
  {
    _id: 'task-1',
    organisationId: ORG_ID,
    name: 'Midday analgesia round',
    status: 'PENDING',
    assignedBy: ELENA,
    assignedTo: RAVI,
    audience: 'EMPLOYEE_TASK',
    source: 'CUSTOM',
    category: 'MEDICATION',
    description: 'Recorded against the inpatient chart.',
    dueAt: new Date(2026, 7, 19, 12, 0),
  },
];

const SUBSCRIPTION: BillingSubscription = {
  orgId: ORG_ID,
  plan: 'free',
  accessState: 'free',
  subscriptionStatus: 'none',
};

const COUNTER: BillingCounter = { orgId: ORG_ID, freeUsersLimit: 10, usersBillableCount: 4 };

/**
 * Every store the page or its guard touches, snapshotted as a group so a seeded
 * organisation cannot leak into the next story. Zustand `setState` merges, so
 * writing the whole previous state back restores both data and actions.
 */
type SnapshotableStore = {
  getState: () => unknown;
  setState: (partial: never) => void;
};

const SEEDED_STORES: SnapshotableStore[] = [
  useAppointmentStore,
  useAuthStore,
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
 * Offline transport.
 *
 * Seeding the stores silences eleven of OrgGuard's twelve loaders - each one
 * bails on its first line once its `…ByOrgId` map holds the org - but two
 * sources always reach the wire: `useLoadSubscriptionCounterForPrimaryOrg`
 * fetches unconditionally, and every Stat card asks `useDashboardAnalytics` for
 * seven series. Left alone those fail, and `getData` logs each failure through
 * `logger.error`, which is a console error the story verifier counts as a
 * failure. Axios picks the XHR adapter in the browser, so swapping
 * `XMLHttpRequest` is the seam that needs no module mocking.
 *
 * The body is `[]`, not `{}`. `ChangeRoom` mounts CLOSED behind the schedule and
 * refetches rooms with `force: true` regardless, and that service calls
 * `res.data.map` straight off the payload - an object body threw there and the
 * TypeError surfaced as a console error. An empty array reads as "no rows" to
 * the list callers and as "no fields" to the finance normalisers, which only
 * ever look properties up.
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
  /** false renders the page with no organisation resolved at all. */
  withOrg?: boolean;
  /** Takes `analytics:view:any` back off the owner role. */
  revokeAnalytics?: boolean;
  /** 'loading' holds OrgGuard on its skeleton. */
  orgStatus?: 'loading' | 'loaded';
};

const seedDashboard = ({ withOrg = true, revokeAnalytics = false, orgStatus = 'loaded' }: Seed) => {
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = OfflineXhr as unknown as typeof XMLHttpRequest;

  const snapshots = SEEDED_STORES.map((store) => [store, store.getState()] as const);

  useAuthStore.setState({
    status: 'authenticated',
    attributes: { given_name: 'Elena', family_name: 'Marsh' },
  });

  useOrgStore.setState({
    orgsById: withOrg ? { [ORG_ID]: ORG } : {},
    orgIds: withOrg ? [ORG_ID] : [],
    primaryOrgId: withOrg ? ORG_ID : null,
    membershipsByOrgId: withOrg
      ? { [ORG_ID]: buildMembership(revokeAnalytics ? [PERMISSIONS.ANALYTICS_VIEW_ANY] : []) }
      : {},
    status: orgStatus,
  });

  useUserProfileStore.setState({ profilesByOrgId: { [ORG_ID]: PROFILE }, status: 'loaded' });
  useAvailabilityStore.getState().setAvailabilitiesForOrg(ORG_ID, AVAILABILITY);
  useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAM);
  useAppointmentStore.getState().setAppointmentsForOrg(ORG_ID, APPOINTMENTS);
  useTaskStore.getState().setTasksForOrg(ORG_ID, TASKS);
  useSubscriptionStore.getState().setSubscriptionForOrg(ORG_ID, SUBSCRIPTION);
  useCounterStore.getState().setCounterForOrg(ORG_ID, COUNTER);

  /* An empty list still counts as "loaded for this org": the loaders test for
     the KEY, not for rows, so these are what keep them off the network. */
  useOrganisationRoomStore.setState({ roomIdsByOrgId: { [ORG_ID]: [] } });
  useCompanionStore.setState({ companionsIdsByOrgId: { [ORG_ID]: [] } });
  useOrganizationDocumentStore.setState({ documentIdsByOrgId: { [ORG_ID]: [] } });
  useInvoiceStore.setState({ invoiceIdsByOrgId: { [ORG_ID]: [] } });
  useIntegrationStore.setState({ integrationIdsByOrgId: { [ORG_ID]: [] } });
  useSpecialityStore.setState({ specialityIdsByOrgId: { [ORG_ID]: [] } });
  useFormsStore.setState({ lastFetchedByOrgId: { [ORG_ID]: '2026-08-19T00:00:00.000Z' } });
  /* The inventory module is the one loader keyed on a timestamp rather than on
     the presence of the org. */
  useInventoryStore.setState({
    itemIdsByOrgId: { [ORG_ID]: [] },
    statusByOrgId: { [ORG_ID]: 'loaded' },
    lastFetchedByOrgId: { [ORG_ID]: '2026-08-19T00:00:00.000Z' },
  });

  return () => {
    globalThis.XMLHttpRequest = original;
    for (const [store, state] of snapshots) {
      store.setState(state as never);
    }
  };
};

const withDashboard =
  (seed: Seed = {}) =>
  () =>
    seedDashboard(seed);

/**
 * `waitFor` defaults to one second, which is not enough for the FIRST story in a
 * run: ten `next/dynamic` chunks are still being fetched, and every later story
 * reads them from cache. That difference made this file pass or fail purely on
 * story order.
 */
const SETTLE = { timeout: 10_000 };

/** The page's own column. Absent while a guard is still showing its skeleton. */
const pageContent = async (canvasElement: HTMLElement) =>
  waitFor(() => {
    const element = canvasElement.querySelector('.yc-page-content');
    expect(element).not.toBeNull();
    return element as HTMLElement;
  }, SETTLE);

/**
 * The ten widgets arrive as separate `next/dynamic` chunks and resolve in
 * whatever order the network hands them back, NOT in source order - waiting on
 * the one that comes last in the layout proves nothing about the rest. That is
 * how the first draft of these stories failed: Availability mounted, Schedule
 * had not, and the query for it threw. Wait for one anchor per block instead.
 */
const waitForWidgets = (canvas: ReturnType<typeof within>) =>
  waitFor(() => {
    const schedule = canvas.getByRole('heading', { level: 2, name: /^Schedule/ });
    const availability = canvas.getByRole('heading', { level: 2, name: /^Availability/ });
    canvas.getByText('Appointment leaders');
    canvas.getByText('Annual inventory turnover');
    return { availability, schedule };
  }, SETTLE);

/**
 * Both `PermissionGate`s render a fragment, so the two breakpoint-gated rows are
 * direct children of the page column alongside the ungated widgets - which is
 * what makes "exactly two rows are gated" a checkable statement rather than a
 * class-name spot check.
 */
const gatedRows = (page: HTMLElement) =>
  ([...page.children] as HTMLElement[]).filter((row) => row.classList.contains('hidden'));

const trackCount = (element: HTMLElement) =>
  globalThis.getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;

/**
 * Asserts the responsive contract as a RELATION against the same media query the
 * Tailwind classes encode, rather than against a hard-coded display value.
 *
 * The viewport global only resizes the preview iframe when Storybook's manager
 * drives it. `storyqa-verify` opens `iframe.html` directly, where the iframe
 * keeps the runner's width and every media query answers for THAT width - so a
 * `Phone` story that asserted `display: none` outright would be asserting
 * something the runner never renders. Written as a relation it holds at any
 * width, and it still fails the two ways that matter: move the rows to another
 * breakpoint and the computed display stops tracking `md`; drop `hidden` and
 * they stay visible below it.
 */
const expectBreakpointLayout = async (page: HTMLElement) => {
  const atMdOrWider = globalThis.matchMedia('(min-width: 768px)').matches;
  const gated = gatedRows(page);

  // The day charts and the inventory turnover pair - and nothing else.
  await expect(gated).toHaveLength(2);
  for (const row of gated) {
    await expect(globalThis.getComputedStyle(row).display).toBe(atMdOrWider ? 'grid' : 'none');
    if (atMdOrWider) await expect(trackCount(row)).toBe(2);
  }

  /* The leaders row is the design's phone exception: it stays, and stacks. If it
     ever picks up `hidden` the length check above catches it, so this pins the
     other half - one column below md, two from md up. */
  const leaders = ([...page.children] as HTMLElement[]).find(
    (row) => row.textContent?.includes('Appointment leaders') && row.tagName === 'DIV'
  ) as HTMLElement;
  await expect(globalThis.getComputedStyle(leaders).display).toBe('grid');
  await expect(trackCount(leaders)).toBe(atMdOrWider ? 2 : 1);
};

const meta = {
  title: 'Dashboard/Dashboard',
  component: ProtectedDashboard,
  parameters: {
    layout: 'fullscreen',
    // ProtectedRoute and OrgGuard both read usePathname, AppointmentTask uses
    // useRouter, and the permission notice pushes with it.
    nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } },
    docs: {
      description: {
        component:
          'The PIMS landing page. Ten widgets arrive through `next/dynamic` behind `animate-pulse` ' +
          'placeholders, in the design scroll order: greeting, get-started steps, videos, explore, ' +
          'day charts, schedule, leaders, inventory turnover, availability. Two of those blocks sit ' +
          'behind `analytics:view:any` with an inline `Fallback`, and two rows are dropped below the ' +
          '`md` breakpoint - the phone frames jump from the stat tiles straight to the schedule. ' +
          'The export is the GUARDED page, so every story seeds the auth and org stores the way ' +
          'bootstrap does and swaps the XHR transport, rather than reaching for a component that is ' +
          'not exported.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withDashboard(),
} satisfies Meta<typeof ProtectedDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Owner, full permissions',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = await pageContent(canvasElement);

    const { availability, schedule } = await waitForWidgets(canvas);

    const rows = [...page.children] as HTMLElement[];
    const indexOfRowContaining = (node: HTMLElement) => rows.findIndex((row) => row.contains(node));
    const indexOfRowWithText = (text: string) =>
      rows.findIndex((row) => row.textContent?.includes(text));

    /* The source comments claim one order (explore -> charts -> schedule ->
       leaders -> turnover -> availability) and the markup is the only thing that
       enforces it. Reordering the JSX is a silent change: every widget still
       renders, the page just stops matching the design. */
    const order = [
      indexOfRowWithText('Explore'),
      indexOfRowWithText('Annual inventory turnover'),
      indexOfRowContaining(schedule),
      indexOfRowWithText('Appointment leaders'),
      indexOfRowContaining(availability),
    ];
    const [explore, turnover, scheduleRow, leadersRow, availabilityRow] = order;
    await expect(explore).toBeGreaterThanOrEqual(0);
    await expect(explore).toBeLessThan(scheduleRow);
    await expect(scheduleRow).toBeLessThan(leadersRow);
    await expect(leadersRow).toBeLessThan(turnover);
    await expect(turnover).toBeLessThan(availabilityRow);

    // Nothing is gated away for an owner: a "Request access" notice here means a
    // permission the role table is supposed to grant has gone missing.
    await expect(canvas.queryByRole('button', { name: 'Request access' })).toBeNull();

    await expectBreakpointLayout(page);
  },
};

export const Tablet: Story = {
  name: 'Tablet (768)',
  globals: { viewport: { value: 'tablet', isRotated: false } },
  parameters: {
    chromatic: { viewports: [768] },
    docs: {
      description: {
        story:
          'The first width at which the charts and turnover rows exist. Both are two-up here, the ' +
          'same as desktop - only the page padding changes between 768 and 1280.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const page = await pageContent(canvasElement);
    await waitForWidgets(within(canvasElement));
    await expectBreakpointLayout(page);
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The phone frames drop the vertical day charts and the inventory turnover pair entirely and ' +
          'stack the leaders bars into one column. Everything else is the same page.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const page = await pageContent(canvasElement);
    await waitForWidgets(within(canvasElement));
    await expectBreakpointLayout(page);

    // Nothing on the page may push the document sideways at 375.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};

export const AnalyticsDenied: Story = {
  name: 'Analytics denied',
  beforeEach: withDashboard({ revokeAnalytics: true }),
  parameters: {
    // Deliberately not /dashboard. That route declares `analytics:view:any` in
    // appRoutes, so OrgGuard bounces this membership to /organization before the
    // page can mount - the two Fallback panels are unreachable from the
    // dashboard URL as the routes stand. Pinning the pathname to a route the
    // membership CAN open is the only way to review the state the component
    // still renders code for.
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        story:
          'A membership with `analytics:view:any` revoked. Both gated blocks collapse to the inline ' +
          'permission notice, which quotes the real role rather than a generic "Not authorized", and ' +
          'the ungated widgets are untouched. Note the route guard gates /dashboard on the same ' +
          'permission, so this state cannot currently be reached from the dashboard URL.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = await pageContent(canvasElement);

    /* Denial removes the analytics blocks and nothing else, so the two ungated
       widgets are the settle signal here - the gated ones never mount and there
       is nothing else to wait for. */
    await waitFor(() => {
      canvas.getByRole('heading', { level: 2, name: /^Schedule/ });
      canvas.getByRole('heading', { level: 2, name: /^Availability/ });
    }, SETTLE);

    // One notice per gate, and the denial names the membership's own role rather
    // than a generic "Not authorized".
    await expect(canvas.getAllByRole('button', { name: 'Request access' })).toHaveLength(2);
    await expect(page.textContent).toContain('Your role (Owner)');
    await expect(page.textContent).toContain('practice analytics');

    await expect(canvas.queryByText('Appointment leaders')).toBeNull();
    await expect(canvas.queryByText('Annual inventory turnover')).toBeNull();
  },
};

export const NoPrimaryOrganisation: Story = {
  name: 'No primary organisation',
  beforeEach: withDashboard({ withOrg: false }),
  parameters: {
    // Where OrgGuard sends a member with no organisation. Anywhere else it
    // redirects instead of rendering, so this is the one path on which the
    // no-org page is reachable at all.
    nextjs: { appDirectory: true, navigation: { pathname: '/organizations' } },
    docs: {
      description: {
        story:
          'With no organisation resolved, `DashboardProfile` returns null rather than greeting nobody, ' +
          'and every permission-gated widget falls back - `usePermissions` reports an empty set, not a ' +
          'loading one. What is left is the ungated furniture plus two permission notices that have no ' +
          'role to quote.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = await pageContent(canvasElement);

    // The greeting is skipped entirely - not rendered blank with a missing name.
    await expect(canvas.queryByText('Welcome back,')).toBeNull();

    await waitFor(() => expect(page.textContent).toContain('your current role'), SETTLE);
    /* The schedule and availability gates carry no fallback, so they render
       nothing rather than stacking four notices on one page. */
    await expect(canvas.queryByRole('heading', { level: 2, name: /^Schedule/ })).toBeNull();
    await expect(canvas.getAllByRole('button', { name: 'Request access' })).toHaveLength(2);
  },
};

export const GuardSkeleton: Story = {
  name: 'Waiting on the organisation',
  beforeEach: withDashboard({ orgStatus: 'loading' }),
  parameters: {
    docs: {
      description: {
        story:
          "OrgGuard's `PageSkeleton`, held open by an org store that has not settled. The point is " +
          'what is NOT here: the dashboard must not mount before the organisation is known, or ten ' +
          'org-scoped loaders fire with no org to scope to. The per-widget `animate-pulse` ' +
          'placeholders behind `next/dynamic` are a different, much shorter window and resolve too ' +
          'fast to pin as a story.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // The page column is the proof: its absence means Dashboard never mounted.
    await expect(canvasElement.querySelector('.yc-page-content')).toBeNull();
    await expect(canvasElement.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  },
};
