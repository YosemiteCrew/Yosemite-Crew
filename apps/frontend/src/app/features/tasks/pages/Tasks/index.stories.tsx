import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import type { Team } from '@/app/features/organization/types/team';
import type { Task } from '@/app/features/tasks/types/task';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import { useParentStore } from '@/app/stores/parentStore';
import { useSearchStore } from '@/app/stores/searchStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Tasks from './index';

const ORG_ID = 'org-storybook-tasks';
const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const MARTA = 'parent-marta';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/**
 * Every shipped role carries `tasks:view:any` and `tasks:edit:any`, so both the
 * denied and the read-only stories are only reachable through `revokedPermissions`
 * - which is also how a practice really takes those rights off one person.
 */
const membership = (revoked: string[] = []): UserOrganization => ({
  id: 'membership-owner',
  practitionerReference: `Practitioner/${ELENA}`,
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const teamMember = (practionerId: string, name: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

/** Elena is the signed-in user throughout - `authStore.attributes.sub` below. */
const TEAM: Team[] = [teamMember(ELENA, 'Dr. Elena Marsh'), teamMember(RAVI, 'Dr. Ravi Patel')];

const PARENT: StoredParent = {
  id: MARTA,
  firstName: 'Marta',
  lastName: 'Alvarez',
  email: 'marta.alvarez@example.com',
  phoneNumber: '+34 600 000 000',
  address: { city: 'Barcelona', country: 'ES' },
  createdFrom: 'pms',
};

const COMPANION: StoredCompanion = {
  id: 'companion-kiko',
  organisationId: ORG_ID,
  parentId: MARTA,
  name: 'Kiko',
  type: 'dog',
  breed: 'Border Collie',
  dateOfBirth: new Date('2019-04-18T00:00:00.000Z'),
  gender: 'male',
  isInsured: false,
};

const task = (
  over: Partial<Task> & Pick<Task, '_id' | 'name' | 'assignedTo' | 'status'>
): Task => ({
  organisationId: ORG_ID,
  assignedBy: ELENA,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'CARE',
  priority: 'MEDIUM',
  description: '',
  // Fixed instant so the rendered date/time do not depend on the machine running this.
  dueAt: new Date('2026-09-12T12:00:00.000Z'),
  ...over,
});

const TASKS: Task[] = [
  task({
    _id: 'task-pending',
    name: 'Prep surgical suite for TPLO',
    assignedTo: RAVI,
    status: 'PENDING',
    category: 'PROCEDURE',
    priority: 'HIGH',
  }),
  task({
    _id: 'task-in-progress',
    name: 'Midday medication round',
    assignedTo: ELENA,
    assignedBy: RAVI,
    status: 'IN_PROGRESS',
    category: 'MEDICATION',
    priority: 'HIGH',
    companionId: COMPANION.id,
  }),
  task({
    _id: 'task-completed',
    name: 'Post-op discharge call',
    assignedTo: RAVI,
    status: 'COMPLETED',
    category: 'COMMUNICATION',
    completedAt: new Date('2026-09-10T15:00:00.000Z'),
    completedBy: RAVI,
  }),
  task({
    _id: 'task-parent',
    name: 'Give evening ear drops',
    assignedTo: MARTA,
    status: 'PENDING',
    audience: 'PARENT_TASK',
    category: 'MEDICATION',
    companionId: COMPANION.id,
  }),
];

/**
 * Enough of a profile and one published availability day to clear
 * `computeTeamOnboardingStep`. Below step 3 `OrgGuard` redirects the whole route
 * to /team-onboarding, so an incomplete fixture does not render a worse story -
 * it renders no story at all.
 *
 * These are what let the guards pass on REAL data. The obvious alternative, the
 * `NEXT_PUBLIC_DISABLE_AUTH_GUARD` bypass, works only under the dev server: a
 * production/static build inlines every `process.env.NEXT_PUBLIC_*` read at
 * build time, so assigning one at runtime is a no-op and the guards redirect -
 * which is exactly how these stories rendered an empty page in the static build
 * that Chromatic publishes.
 */
const PROFILE: UserProfile = {
  _id: 'profile-storybook',
  userId: ELENA,
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1989-11-02',
    phoneNumber: '+44 20 7946 0958',
    address: {
      addressLine: '14 Harbour Row',
      city: 'Bristol',
      state: 'Bristol',
      postalCode: 'BS1 4RN',
      country: 'United Kingdom',
    },
  },
  professionalDetails: {
    qualification: 'BVSc MRCVS',
    yearsOfExperience: 8,
    specialization: 'Internal medicine',
  },
  status: 'COMPLETED',
};

const AVAILABILITY: ApiDayAvailability = {
  _id: 'availability-monday',
  userId: ELENA,
  organisationId: ORG_ID,
  dayOfWeek: 'MONDAY',
  slots: [
    { startTime: '09:00', endTime: '17:00', isAvailable: true },
  ] as ApiDayAvailability['slots'],
};

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * The page itself never calls axios directly - every list it shows comes
 * straight out of the seeded stores. But `OrgGuard` unconditionally runs
 * `useLoadSubscriptionCounterForPrimaryOrg` on every org-scoped route, and that
 * hook always hits the finance endpoints below regardless of what the current
 * page is about, so the adapter still has to answer them.
 */
const buildAdapter = (): AxiosAdapter => (config: InternalAxiosRequestConfig) => {
  const url = String(config.url ?? '');
  if (url.includes('/v1/finance/subscriptions/current')) {
    return Promise.resolve(respond(config, { data: { organisationId: ORG_ID, currency: 'GBP' } }));
  }
  if (url.includes('/v1/finance/usage-snapshots')) {
    return Promise.resolve(respond(config, { data: [] }));
  }
  return Promise.resolve(respond(config, []));
};

const REAL_ADAPTER = api.defaults.adapter;

/**
 * The page ships behind `ProtectedRoute` and `OrgGuard`. The stories satisfy the
 * guards with real data - an authenticated session, a verified org, an active
 * membership, a profile past onboarding step 3 and one availability row - rather
 * than with the `NEXT_PUBLIC_DISABLE_AUTH_GUARD` bypass, which only works under
 * the dev server: a static build inlines every `process.env.NEXT_PUBLIC_*` read
 * at build time, so assigning one at runtime changes nothing and the guards
 * redirect.
 *
 * `OrgGuard` also runs its other ten org-scoped loaders on this route, so every
 * store they touch is seeded with an entry for this org so they short-circuit on
 * `Object.hasOwn(...ByOrgId, primaryOrgId)` rather than reaching the network.
 * Team, task, companion and parent data are seeded for real: the calendar,
 * board and list panes all resolve assignee and companion names from them.
 */
const prepare =
  ({
    tasks = TASKS,
    team = TEAM,
    companions = [COMPANION],
    revoked = [],
  }: {
    tasks?: Task[];
    team?: Team[];
    companions?: StoredCompanion[];
    revoked?: string[];
  } = {}) =>
  () => {
    clearInFlightGetRequests();

    const snapshots = {
      appointment: useAppointmentStore.getState(),
      auth: useAuthStore.getState(),
      profile: useUserProfileStore.getState(),
      availability: useAvailabilityStore.getState(),
      companion: useCompanionStore.getState(),
      document: useOrganizationDocumentStore.getState(),
      forms: useFormsStore.getState(),
      integration: useIntegrationStore.getState(),
      inventory: useInventoryStore.getState(),
      invoice: useInvoiceStore.getState(),
      org: useOrgStore.getState(),
      parent: useParentStore.getState(),
      room: useOrganisationRoomStore.getState(),
      search: useSearchStore.getState(),
      speciality: useSpecialityStore.getState(),
      subscription: useSubscriptionStore.getState(),
      task: useTaskStore.getState(),
      team: useTeamStore.getState(),
    };
    api.defaults.adapter = buildAdapter();

    const emptyIndex = { [ORG_ID]: [] as string[] };
    const fetchedAt = { [ORG_ID]: new Date().toISOString() };

    useAuthStore.setState({
      status: 'authenticated',
      attributes: {
        sub: ELENA,
        email: 'elena.marsh@example.com',
        given_name: 'Elena',
        family_name: 'Marsh',
      },
    });
    useUserProfileStore.setState({ profilesByOrgId: { [ORG_ID]: PROFILE }, status: 'loaded' });
    useAvailabilityStore.setState({
      availabilitiesById: { [AVAILABILITY._id]: AVAILABILITY },
      availabilityIdsByOrgId: { [ORG_ID]: [AVAILABILITY._id] },
      status: 'loaded',
    });
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: ORG },
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    useTeamStore.getState().setTeamsForOrg(ORG_ID, team);
    useSpecialityStore.setState({ specialityIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganisationRoomStore.setState({ roomIdsByOrgId: emptyIndex, status: 'loaded' });
    useInvoiceStore.setState({ invoiceIdsByOrgId: emptyIndex, status: 'loaded' });
    useTaskStore.getState().setTasksForOrg(ORG_ID, tasks);
    useOrganizationDocumentStore.setState({ documentIdsByOrgId: emptyIndex, status: 'loaded' });
    useIntegrationStore.setState({ integrationIdsByOrgId: emptyIndex, status: 'loaded' });
    useAppointmentStore.setState({
      appointmentIdsByOrgId: emptyIndex,
      appointmentsById: {},
      status: 'loaded',
    });
    useCompanionStore.getState().setCompanionsForOrg(ORG_ID, companions);
    useParentStore.getState().setParents([PARENT]);
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'GBP' } },
    });
    // The shared mobile search bar writes here; a query left by another story
    // would filter this one's list before it even renders.
    useSearchStore.setState({ query: '' });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useTeamStore.setState(snapshots.team);
      useTaskStore.setState(snapshots.task);
      useSubscriptionStore.setState(snapshots.subscription);
      useSpecialityStore.setState(snapshots.speciality);
      useSearchStore.setState(snapshots.search);
      useParentStore.setState(snapshots.parent);
      useOrganisationRoomStore.setState(snapshots.room);
      useOrgStore.setState(snapshots.org);
      useInvoiceStore.setState(snapshots.invoice);
      useInventoryStore.setState(snapshots.inventory);
      useIntegrationStore.setState(snapshots.integration);
      useFormsStore.setState(snapshots.forms);
      useOrganizationDocumentStore.setState(snapshots.document);
      useCompanionStore.setState(snapshots.companion);
      useAvailabilityStore.setState(snapshots.availability);
      useUserProfileStore.setState(snapshots.profile);
      useAuthStore.setState(snapshots.auth);
      useAppointmentStore.setState(snapshots.appointment);
      clearInFlightGetRequests();
    };
  };

/** Switches the planner from its default Calendar pane to List or Board. */
const switchView = async (canvasElement: HTMLElement, label: 'List' | 'Board') => {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole('button', { name: label }));
};

const meta = {
  title: 'Tasks/Tasks',
  component: Tasks,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname.
    nextjs: { appDirectory: true, navigation: { pathname: '/tasks' } },
    docs: {
      description: {
        component:
          'The Tasks page: one list of to-dos shared between three panes - a day/week/team ' +
          'Calendar, a status Board, and a sortable List - plus the dialogs that create, view, ' +
          'change the status of, and reschedule a task.\n\n' +
          'All three panes read the same filtered list, computed once in the page from the ' +
          'audience pill, the status pill, the search query and (in List and phone Calendar) the ' +
          '"My tasks / Team" scope toggle. The Board view ignores the status filter outright - a ' +
          'status pill would be redundant next to four status columns - and the scope toggle only ' +
          'applies while its own row is on screen, so a "My tasks" choice made in List cannot leak ' +
          'into Calendar as a filter with no visible way to clear it.\n\n' +
          'Cancelled is dropped from the status pills shown here (the shared list still carries it ' +
          'in full for other surfaces), and the calendar header keeps only the pet-parent audience ' +
          'pill, since it already has its own Day/Week/Team switcher for staff scope.\n\n' +
          'The stories lift the route guards with real data - an authenticated session, a verified ' +
          'org, an active membership, a profile past onboarding step 3 and one availability row - ' +
          'seed every org-scoped store `OrgGuard` would otherwise load, and answer the two finance ' +
          'calls its subscription loader always makes, regardless of what the page itself is about.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare(),
} satisfies Meta<typeof Tasks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Calendar view (default)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Tasks (4)' })).toBeVisible();
    await expect(canvas.getByText(/Track to-dos, assign the team or pet parents/)).toBeVisible();

    // Calendar is the default pane, opened on Week. The calendar itself is
    // behind a `next/dynamic` import, so its own Day/Week/Team switch is
    // awaited rather than read synchronously.
    await expect(canvas.getByRole('button', { name: 'Calendar', pressed: true })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Week', pressed: true })).toBeVisible();

    // Desktop calendar hides the standalone filter row - the pet-parent pill and
    // the Day/Week/Team switcher already live in the calendar's own header.
    await expect(canvas.queryByRole('group', { name: 'Task scope' })).not.toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Search tasks')).toBeInTheDocument();
  },
};

export const ListView: Story = {
  name: 'List view',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchView(canvasElement, 'List');

    // The filter row appears only once List is active: audience, status and
    // scope pills, plus the desktop "New task" action next to them.
    await expect(await canvas.findByRole('button', { name: 'Pending' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'In progress' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Completed' })).toBeVisible();
    // Cancelled is trimmed from this page's pill row.
    await expect(canvas.queryByRole('button', { name: 'Cancelled' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Pet parents' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'New task' })).toBeEnabled();

    /* All four seeded tasks are on screen, named rather than printed as ids.
       The list renders through TWO always-mounted siblings - a `GenericTable`
       row and a `PaginatedCardList` card for the same data - switched by a CSS
       breakpoint rather than by React, so each name can legitimately match more
       than one node; counted rather than fetched singly. */
    await expect(
      (await canvas.findAllByText('Prep surgical suite for TPLO')).length
    ).toBeGreaterThan(0);
    await expect(canvas.getAllByText('Midday medication round').length).toBeGreaterThan(0);
    await expect(canvas.getAllByText('Post-op discharge call').length).toBeGreaterThan(0);
    await expect(canvas.getAllByText('Give evening ear drops').length).toBeGreaterThan(0);
  },
};

export const BoardView: Story = {
  name: 'Board view',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchView(canvasElement, 'Board');

    // Four status columns. Their labels are sentence case in the DOM - the
    // ALL-CAPS look is a CSS `uppercase` transform, not the rendered text.
    await expect((await canvas.findAllByText('Pending')).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText('In progress').length).toBeGreaterThan(0);
    await expect(canvas.getAllByText('Completed').length).toBeGreaterThan(0);
    await expect(canvas.getAllByText('Cancelled').length).toBeGreaterThan(0);

    await expect(canvas.getByText('Prep surgical suite for TPLO')).toBeVisible();
    // The signed-in assignee's own card reads "you" rather than her full name.
    await expect(canvas.getByText('Midday medication round')).toBeVisible();
    await expect(canvas.getByText('you')).toBeVisible();

    // Only the Pending column offers a quick-add action, and only because this
    // fixture's membership can edit tasks.
    await expect(canvas.getByRole('button', { name: 'Add task to Pending' })).toBeEnabled();
    // The empty Cancelled column names itself rather than rendering nothing.
    await expect(canvas.getAllByText('No tasks').length).toBeGreaterThan(0);
  },
};

export const NoTasks: Story = {
  name: 'No tasks yet',
  beforeEach: prepare({ tasks: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Tasks (0)' })).toBeVisible();

    await switchView(canvasElement, 'List');
    // Same table + card duplication as the populated list: count rather than
    // fetch a single node.
    await expect((await canvas.findAllByText('No tasks yet')).length).toBeGreaterThan(0);
    await expect(
      canvas.getAllByText('Tasks appear here as soon as there are any.').length
    ).toBeGreaterThan(0);
  },
};

export const PermissionDenied: Story = {
  name: 'Tasks view revoked - denied state',
  beforeEach: prepare({ revoked: ['tasks:view:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The title bar and its Calendar/Board/List switch sit ABOVE the
    // `PermissionGate`, so they still render with the real task count; only the
    // gated body underneath is swapped for the denied card.
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Tasks (4)' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'List' })).toBeVisible();
    await expect(await canvas.findByText("You don't have access to Tasks")).toBeVisible();
    await expect(
      canvas.getByText(/Your role \(Owner\) can.t view tasks and assignments\./)
    ).toBeVisible();
    // Nothing from the guarded planner leaks out from behind the denied card.
    await expect(canvas.queryByText('Prep surgical suite for TPLO')).not.toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Task edit revoked - no New task, no quick-add',
  beforeEach: prepare({ revoked: ['tasks:edit:any', 'tasks:edit:own'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchView(canvasElement, 'List');

    // Viewing still works; only the create/mutate affordances are gone.
    await expect(
      (await canvas.findAllByText('Prep surgical suite for TPLO')).length
    ).toBeGreaterThan(0);
    await expect(canvas.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();

    await switchView(canvasElement, 'Board');
    // Wait for the board to finish loading before asserting the button's absence.
    await expect((await canvas.findAllByText('Pending')).length).toBeGreaterThan(0);
    await expect(
      canvas.queryByRole('button', { name: 'Add task to Pending' })
    ).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Below 768px the calendar pane shows the filter row too - it is the only
    // way to reach the pet-parent and scope filters without a List switch.
    await expect(await canvas.findByRole('button', { name: 'Pending' })).toBeVisible();
    await waitFor(() =>
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    );
  },
};
