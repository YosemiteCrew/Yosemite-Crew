import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Appointment, Organisation, UserOrganization } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { PERMISSIONS } from '@/app/lib/permissions';
import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useSearchStore } from '@/app/stores/searchStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';

import Companions from './Companions';

const ORG_ID = 'org-companions-story';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Boarding',
  // BOARDER keeps the "companion" noun, which is what makes the heading
  // mismatch below visible: the noun is rewritten, the count is not.
  type: 'BOARDER',
  phoneNo: '+49 30 555 0134',
  taxId: 'TAX-0001',
  isVerified: true,
};

const FULL_ACCESS = [
  PERMISSIONS.COMPANIONS_VIEW_ANY,
  PERMISSIONS.COMPANIONS_EDIT_ANY,
  PERMISSIONS.APPOINTMENTS_EDIT_ANY,
  PERMISSIONS.TASKS_EDIT_ANY,
];

/**
 * `roleCode` is deliberately empty. `resolveMembershipPermissions` returns the
 * extras verbatim when there is no role, so a story's permission set is exactly
 * the array it names rather than a role baseline it has to reason about.
 */
const membership = (permissions: string[]): UserOrganization => ({
  practitionerReference: 'Practitioner/user-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: '',
  roleDisplay: 'Front desk',
  active: true,
  extraPermissions: permissions,
  revokedPermissions: [],
});

/**
 * Enough of a profile to clear `computeTeamOnboardingStep`. Below step 3 the org
 * guard redirects the whole page to /team-onboarding, so an incomplete fixture
 * does not render a worse story, it renders no story at all.
 */
const PROFILE: UserProfile = {
  _id: 'profile-1',
  userId: 'user-1',
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1989-11-02',
    phoneNumber: '+49 30 901820',
    address: {
      addressLine: 'Wallstrasse 14',
      city: 'Berlin',
      state: 'Berlin',
      postalCode: '10179',
      country: 'Germany',
    },
  },
  professionalDetails: {
    qualification: 'DVM',
    yearsOfExperience: 8,
    specialization: 'General practice',
  },
  status: 'COMPLETED',
};

const AVAILABILITY: ApiDayAvailability = {
  _id: 'availability-1',
  userId: 'user-1',
  organisationId: ORG_ID,
  dayOfWeek: 'MONDAY',
  slots: [
    { startTime: '09:00', endTime: '17:00', isAvailable: true },
  ] as ApiDayAvailability['slots'],
};

const parent = (id: string, firstName: string, lastName: string): StoredParent => ({
  id,
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}@example.com`,
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
});

const PARENTS: StoredParent[] = [
  parent('parent-1', 'Lena', 'Hartmann'),
  parent('parent-2', 'Tomas', 'Ruiz'),
  parent('parent-3', 'Ada', 'Whitfield'),
  parent('parent-4', 'Marc', 'Fabre'),
  parent('parent-5', 'Ivy', 'Novak'),
  parent('parent-6', 'Kemi', 'Adeyemi'),
];

type CompanionSeed = {
  id: string;
  name: string;
  type: StoredCompanion['type'];
  breed: string;
  parentId: string;
  status: StoredCompanion['status'];
};

const companion = ({
  id,
  name,
  type,
  breed,
  parentId,
  status,
}: CompanionSeed): StoredCompanion => ({
  id,
  organisationId: ORG_ID,
  parentId,
  name,
  type,
  breed,
  // Local-time constructor: a UTC literal slides a day either side of the
  // runner's offset, and the row prints an age derived from it.
  dateOfBirth: new Date(2021, 3, 18),
  gender: 'female',
  isInsured: false,
  status,
});

const COMPANIONS: StoredCompanion[] = [
  companion({
    id: 'companion-1',
    name: 'Poppy',
    type: 'dog',
    breed: 'Beagle',
    parentId: 'parent-1',
    status: 'active',
  }),
  companion({
    id: 'companion-2',
    name: 'Rufus',
    type: 'dog',
    breed: 'Labrador',
    parentId: 'parent-1',
    status: 'active',
  }),
  companion({
    id: 'companion-3',
    name: 'Biscuit',
    type: 'dog',
    breed: 'Whippet',
    parentId: 'parent-6',
    status: 'inactive',
  }),
  companion({
    id: 'companion-4',
    name: 'Mango',
    type: 'cat',
    breed: 'Ragdoll',
    parentId: 'parent-2',
    status: 'active',
  }),
  companion({
    id: 'companion-5',
    name: 'Comet',
    type: 'cat',
    breed: 'Bengal',
    parentId: 'parent-3',
    status: 'archived',
  }),
  companion({
    id: 'companion-6',
    name: 'Juno',
    type: 'horse',
    breed: 'Friesian',
    parentId: 'parent-4',
    status: 'active',
  }),
  companion({
    id: 'companion-7',
    name: 'Pip',
    type: 'other',
    breed: 'Netherland dwarf',
    parentId: 'parent-5',
    status: 'active',
  }),
  {
    /* A species the union does not name. Imports arrive with free-form species
       strings, and `resolveSpeciesBucket` folds anything unrecognised into
       Exotics - the branch that used to disagree with the tab count, so the tab
       showed a number and then rendered an empty list. */
    ...companion({
      id: 'companion-8',
      name: 'Nutmeg',
      type: 'other',
      breed: 'Sun conure',
      parentId: 'parent-5',
      status: 'active',
    }),
    type: 'bird' as StoredCompanion['type'],
  },
];

/** Local-time offsets from now, never a UTC literal - see `isToday`/`getLastVisit`. */
const NOW = new Date();
const at = (dayOffset: number, hour: number, minute: number) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + dayOffset, hour, minute);

const booking = (
  id: string,
  companionId: string,
  name: string,
  start: Date,
  over: Partial<Appointment> = {}
): Appointment => ({
  id,
  organisationId: ORG_ID,
  patient: {
    id: companionId,
    name,
    species: 'dog',
    breed: '',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  appointmentDate: start,
  startTime: start,
  endTime: new Date(start.getTime() + 30 * 60_000),
  timeSlot: '30',
  durationMinutes: 30,
  status: 'UPCOMING',
  ...over,
});

/**
 * Three past visits with an unambiguous order, plus one booking today so the
 * "In the clinic today" band has something to draw. Today's booking is
 * deliberately for a companion the sort assertions do not name: whether it
 * counts as a "last visit" depends on the hour the suite runs.
 */
const APPOINTMENTS: Appointment[] = [
  booking('appt-poppy', 'companion-1', 'Poppy', at(-30, 9, 0)),
  booking('appt-mango', 'companion-4', 'Mango', at(-3, 11, 0)),
  booking('appt-juno', 'companion-6', 'Juno', at(-1, 14, 30)),
  booking('appt-today', 'companion-3', 'Biscuit', at(0, 10, 30), {
    concern: 'Post-op check',
    status: 'CHECKED_IN',
  }),
];

const TERMINOLOGY_KEYS = ['yc_companion_terminology_by_org', 'yc_companion_terminology_pending'];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse =>
  ({ data, status: 200, statusText: 'OK', headers: config.headers, config }) as AxiosResponse;

type PrepareOptions = {
  permissions?: string[];
  query?: string;
};

/**
 * The whole page, offline.
 *
 * `Companions` only exports the guarded default, so every story renders through
 * the real `ProtectedRoute` + `OrgGuard` rather than around them. That is not
 * free: the org guard mounts eleven org-scoped loaders, so each of their stores
 * is seeded with an entry for this org (the loaders all short-circuit on
 * `Object.hasOwn(...ByOrgId, primaryOrgId)`), and the shared axios adapter is
 * swapped for one that resolves an empty envelope - the billing counter is the
 * one loader with no such guard and would otherwise reject into an unhandled
 * rejection.
 *
 * The guard data itself is real rather than bypassed: an authenticated session,
 * a verified org, an active membership, a profile past onboarding step 3 and one
 * availability row. Miss any of those and the guard throws Next's redirect
 * instead of rendering, which is a loud failure rather than a quiet one.
 */
const prepare =
  ({ permissions = FULL_ACCESS, query = '' }: PrepareOptions = {}) =>
  () => {
    const snapshots = {
      auth: useAuthStore.getState(),
      org: useOrgStore.getState(),
      profile: useUserProfileStore.getState(),
      availability: useAvailabilityStore.getState(),
      companion: useCompanionStore.getState(),
      parent: useParentStore.getState(),
      appointment: useAppointmentStore.getState(),
      team: useTeamStore.getState(),
      speciality: useSpecialityStore.getState(),
      room: useOrganisationRoomStore.getState(),
      invoice: useInvoiceStore.getState(),
      task: useTaskStore.getState(),
      document: useOrganizationDocumentStore.getState(),
      forms: useFormsStore.getState(),
      integration: useIntegrationStore.getState(),
      inventory: useInventoryStore.getState(),
      search: useSearchStore.getState(),
    };
    /* The companion noun is resolved from the org AND from localStorage, so a
       value another story left behind would rename every label on this page. */
    const storageSnapshot = TERMINOLOGY_KEYS.map(
      (key) => [key, globalThis.localStorage.getItem(key)] as const
    );
    for (const [key] of storageSnapshot) globalThis.localStorage.removeItem(key);
    const originalAdapter = api.defaults.adapter;

    /* An empty LIST is the default answer, not an empty object. Two loaders the
       page mounts (the task-template picker inside the closed "Add task" drawer,
       and the YC task library) spread the response straight into an array, so
       `{}` there is not "no data" but a TypeError the service re-reports as a
       console error. The billing endpoints are the exception: they are read
       through a `{ data }` envelope. */
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      const url = String(config.url ?? '');
      if (url.includes('/v1/finance/usage-snapshots')) {
        return Promise.resolve(respond(config, { data: [] }));
      }
      if (url.includes('/v1/finance/')) {
        return Promise.resolve(respond(config, { data: {} }));
      }
      return Promise.resolve(respond(config, []));
    }) as AxiosAdapter;

    const emptyIndex = { [ORG_ID]: [] as string[] };
    const fetchedAt = { [ORG_ID]: new Date().toISOString() };

    useAuthStore.setState({ status: 'authenticated' });
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: ORG },
      membershipsByOrgId: { [ORG_ID]: membership(permissions) },
      status: 'loaded',
    });
    useUserProfileStore.setState({
      profilesByOrgId: { [ORG_ID]: PROFILE },
      status: 'loaded',
    });
    useAvailabilityStore.setState({
      availabilitiesById: { [AVAILABILITY._id]: AVAILABILITY },
      availabilityIdsByOrgId: { [ORG_ID]: [AVAILABILITY._id] },
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: Object.fromEntries(COMPANIONS.map((item) => [item.id, item])),
      companionsIdsByOrgId: { [ORG_ID]: COMPANIONS.map((item) => item.id) },
      status: 'loaded',
    });
    useParentStore.setState({
      parentsById: Object.fromEntries(PARENTS.map((item) => [item.id, item])),
    });
    useAppointmentStore.setState({
      appointmentsById: Object.fromEntries(APPOINTMENTS.map((item) => [item.id as string, item])),
      appointmentIdsByOrgId: { [ORG_ID]: APPOINTMENTS.map((item) => item.id as string) },
      status: 'loaded',
    });
    useTeamStore.setState({ teamIdsByOrgId: emptyIndex, status: 'loaded' });
    useSpecialityStore.setState({ specialityIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganisationRoomStore.setState({ roomIdsByOrgId: emptyIndex, status: 'loaded' });
    useInvoiceStore.setState({ invoiceIdsByOrgId: emptyIndex, status: 'loaded' });
    useTaskStore.setState({ taskIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganizationDocumentStore.setState({ documentIdsByOrgId: emptyIndex, status: 'loaded' });
    useIntegrationStore.setState({ integrationIdsByOrgId: emptyIndex, status: 'loaded' });
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });
    useSearchStore.setState({ query });

    return () => {
      api.defaults.adapter = originalAdapter;
      useSearchStore.setState(snapshots.search);
      useInventoryStore.setState(snapshots.inventory);
      useFormsStore.setState(snapshots.forms);
      useIntegrationStore.setState(snapshots.integration);
      useOrganizationDocumentStore.setState(snapshots.document);
      useTaskStore.setState(snapshots.task);
      useInvoiceStore.setState(snapshots.invoice);
      useOrganisationRoomStore.setState(snapshots.room);
      useSpecialityStore.setState(snapshots.speciality);
      useTeamStore.setState(snapshots.team);
      useAppointmentStore.setState(snapshots.appointment);
      useParentStore.setState(snapshots.parent);
      useCompanionStore.setState(snapshots.companion);
      useAvailabilityStore.setState(snapshots.availability);
      useUserProfileStore.setState(snapshots.profile);
      useOrgStore.setState(snapshots.org);
      useAuthStore.setState(snapshots.auth);
      for (const [key, value] of storageSnapshot) {
        if (value === null) globalThis.localStorage.removeItem(key);
        else globalThis.localStorage.setItem(key, value);
      }
    };
  };

/**
 * `isCompanionRevampEnabled()` reads `process.env` at call time rather than
 * through a build-time constant, so the fork can be driven from a story. The
 * previous value is restored on unmount, including the case where the variable
 * was never set - assigning `undefined` back would leave the string "undefined"
 * behind on some shims, which is not the same as absent.
 */
const withRevampFlag = (enabled: boolean) => () => {
  const previous = process.env.NEXT_PUBLIC_COMPANION_REVAMP;
  if (enabled) process.env.NEXT_PUBLIC_COMPANION_REVAMP = 'true';
  else delete process.env.NEXT_PUBLIC_COMPANION_REVAMP;
  return () => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_COMPANION_REVAMP;
    else process.env.NEXT_PUBLIC_COMPANION_REVAMP = previous;
  };
};

const openedDialog = async (): Promise<HTMLElement> =>
  waitFor(() => {
    const node = globalThis.document.querySelector<HTMLElement>('dialog[open]');
    expect(node).not.toBeNull();
    return node as HTMLElement;
  });

/** One per row/card: the name is the only element carrying this title. */
const rowNames = (canvasElement: HTMLElement): string[] =>
  within(canvasElement)
    .queryAllByTitle('Open companion history')
    .map((node) => (node.textContent ?? '').trim());

const speciesTabs = (canvasElement: HTMLElement): string[] =>
  within(canvasElement)
    .getAllByRole('tab')
    .map((tab) => (tab.textContent ?? '').trim());

const selectedTab = (canvasElement: HTMLElement): string =>
  (
    within(canvasElement)
      .getAllByRole('tab')
      .find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? ''
  ).trim();

const meta = {
  title: 'Companions/Companions',
  component: Companions,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/companions' } },
    docs: {
      description: {
        component:
          'The companions directory: the page itself, rendered through the guards it ships behind ' +
          'rather than around them.\n\n' +
          '**The heading mixes two vocabularies.** `terminologyText` rewrites the title to the ' +
          "org's noun, but the count beside it is the literal `${n} patients, ${n} active` - so a " +
          'boarding facility reads "Companions - 8 patients, 6 active" and a groomer reads "Pets - ' +
          '8 patients". The table header next to it is rewritten correctly, which is what makes ' +
          'the count line stand out.\n\n' +
          '**The species counts are computed from the whole directory, the list from the filters.** ' +
          'Filter to Archived and the tabs still read "All 8 / Cats 2" over a single row, and the ' +
          'header still claims eight patients. Defensible, and completely unexplained on screen - ' +
          'so both halves are drawn below.\n\n' +
          '**Exotics is a catch-all, not a species.** `resolveSpeciesBucket` folds `other` and ' +
          'anything unrecognised into the same bucket, and the tab count and the list filter now ' +
          'share it - they used to disagree, so the tab showed a number and then rendered nothing.\n\n' +
          '**Permissions prune controls rather than disable them.** Without `companions:edit:any` ' +
          'the Add button is not rendered, and the row menu loses Book appointment, Add task and ' +
          'Change status one grant at a time, so the kebab can hold anything from two entries to ' +
          'five.\n\n' +
          '**The `companionId` deep link is a one-shot instruction.** It opens the record and then ' +
          'rewrites the history entry to drop the param, so browser Back cannot replay it.\n\n' +
          '**A feature flag forks every modal the page owns.** `NEXT_PUBLIC_COMPANION_REVAMP` ' +
          'swaps the add/view panels and the booking modal for their revamped equivalents. Nothing ' +
          'in the directory changes, so the flag is invisible until something is opened - and then ' +
          'the panel is 180px wider and, unlike the one it replaces, actually names its own ' +
          'dialog. Both sides are drawn.\n\n' +
          'Everything the page reads is seeded into its stores and the shared axios adapter is ' +
          'stubbed, so no story here touches the network - but the org guard, the permission gate ' +
          'and the terminology rewriter all run for real.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: prepare(),
} satisfies Meta<typeof Companions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Directory: Story = {
  name: 'Populated list view',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The heading, in one string, because the mismatch only shows when the two
       halves are read together: the noun tracks the org, the count does not. */
    await expect(await canvas.findByText('8 patients, 6 active')).toBeVisible();
    const heading = canvas.getByText('8 patients, 6 active').closest('h1') as HTMLElement;
    await expect(heading.textContent).toContain('Companions');

    // The tab counts come from the whole directory, before any filter runs.
    await expect(speciesTabs(canvasElement)).toEqual([
      'All8',
      'Dogs3',
      'Cats2',
      'Horses1',
      // Two: `other` and the unrecognised `bird`, which is the branch the shared
      // bucket resolver exists for.
      'Exotics2',
    ]);
    await expect(selectedTab(canvasElement)).toBe('All8');

    /* Names in store order, formatted companion-dot-owner-LAST-name. Eight rows
       under a `PAGE_SIZE` of 10, so the pager collapses to the count line. */
    await expect(rowNames(canvasElement)).toEqual([
      'Poppy · Hartmann',
      'Rufus · Hartmann',
      'Biscuit · Adeyemi',
      'Mango · Ruiz',
      'Comet · Whitfield',
      'Juno · Fabre',
      'Pip · Novak',
      'Nutmeg · Novak',
    ]);
    await expect(canvas.getByText('Showing 1-8 of 8 companions')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Page 2' })).not.toBeInTheDocument();

    /* The band above the list is data-driven and renders nothing on a quiet day,
       so its presence here is what proves today's booking reached it. */
    await expect(canvas.getByRole('region', { name: 'In the clinic today' })).toBeVisible();

    // List is the default view, and the toggle announces itself through
    // aria-pressed rather than through a class.
    await expect(canvas.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    // Last visit is a toggle, off by default.
    await expect(canvas.getByRole('button', { name: 'Last visit' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(canvas.getByRole('button', { name: 'New companion' })).toBeVisible();
  },
};

export const GridView: Story = {
  name: 'Grid view',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');

    await userEvent.click(canvas.getByRole('button', { name: 'Grid view' }));

    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
    await expect(canvas.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    /* Same eight records, a different tree. The grid drops the column header row
       entirely, so Parent, Breed, Last visit and Patient ID stop being shown at
       all rather than being folded into the card - the card carries breed and
       parent in one subline and nothing else. */
    await expect(rowNames(canvasElement)).toHaveLength(8);
    await expect(canvas.queryByText('Patient ID')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Last visit', { selector: 'span' })).not.toBeInTheDocument();
    // The pager survives the swap, because it sits outside the view branch.
    await expect(canvas.getByText('Showing 1-8 of 8 companions')).toBeVisible();
  },
};

export const ExoticsTab: Story = {
  name: 'Exotics catches the unrecognised species',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');

    await userEvent.click(canvas.getByRole('tab', { name: /Exotics/ }));

    await waitFor(() => expect(selectedTab(canvasElement)).toBe('Exotics2'));
    /* Pip is stored as `other`; Nutmeg is stored as `bird`, which the species
       union does not name. Both land here because the count and the filter now
       run through the SAME bucket resolver - the regression this guards against
       is the tab reading 2 over an empty list. */
    await expect(rowNames(canvasElement)).toEqual(['Pip · Novak', 'Nutmeg · Novak']);
    await expect(canvas.getByText('Showing 1-2 of 2 companions')).toBeVisible();

    // The counts do not move: they are computed from the directory, not from
    // whatever the tabs have narrowed it to.
    await expect(speciesTabs(canvasElement)).toEqual([
      'All8',
      'Dogs3',
      'Cats2',
      'Horses1',
      'Exotics2',
    ]);
  },
};

export const ArchivedOnly: Story = {
  name: 'Status filter: archived',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');

    /* The status filter is a portalled panel, so its options are outside the
       canvas - the trigger is the only part of it inside. */
    await userEvent.click(canvas.getByRole('button', { name: 'All statuses' }));
    const panel = await waitFor(() => {
      const node = globalThis.document.querySelector<HTMLElement>('.yc-glass-overlay');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    await userEvent.click(within(panel).getByRole('button', { name: 'Archived' }));

    await waitFor(() => expect(rowNames(canvasElement)).toEqual(['Comet · Whitfield']));
    // The trigger takes the chosen status' own tint and name.
    await expect(canvas.getByRole('button', { name: 'Archived' })).toBeVisible();

    /* Cats still reads 2 over a list holding one cat, and the header still reads
       eight patients. Both numbers are computed from the unfiltered directory,
       which is defensible and completely unexplained on screen. */
    await expect(speciesTabs(canvasElement)).toEqual([
      'All8',
      'Dogs3',
      'Cats2',
      'Horses1',
      'Exotics2',
    ]);
    await expect(canvas.getByText('8 patients, 6 active')).toBeVisible();
  },
};

export const SearchWithNoMatches: Story = {
  name: 'Search matches nothing',
  beforeEach: prepare({ query: 'zzz' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');

    /* The query lives in a shared store the page never writes to - the phone
       search bar and the desktop shell header both feed it - so the directory
       can open already filtered, which is the case worth drawing. */
    await expect(rowNames(canvasElement)).toEqual([]);
    await expect(canvas.getByText('No data available')).toBeVisible();

    /* And the pager is not rendered at all rather than showing "0 of 0", so the
       empty list loses the only line that would have said why. */
    await expect(canvas.queryByText(/^Showing /)).not.toBeInTheDocument();
    // The tabs keep their counts, so the page insists there are eight companions
    // while showing none.
    await expect(selectedTab(canvasElement)).toBe('All8');
  },
};

export const SortByLastVisit: Story = {
  name: 'Sorted by last visit',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');
    await expect(rowNames(canvasElement)[0]).toBe('Poppy · Hartmann');

    const sort = canvas.getByRole('button', { name: 'Last visit' });
    await userEvent.click(sort);
    await waitFor(() => expect(sort).toHaveAttribute('aria-pressed', 'true'));

    /* Relative order, not absolute positions. Juno was seen yesterday, Mango
       three days ago and Poppy a month ago, so those three must come out in that
       order; today's booking belongs to a fourth companion on purpose, because
       whether it counts as a "last visit" depends on the hour the suite runs. */
    const order = rowNames(canvasElement);
    await expect(order.indexOf('Juno · Fabre')).toBeLessThan(order.indexOf('Mango · Ruiz'));
    await expect(order.indexOf('Mango · Ruiz')).toBeLessThan(order.indexOf('Poppy · Hartmann'));
    // Sorting reorders, it never filters: all eight are still on screen.
    await expect(order).toHaveLength(8);

    // Companions with no visit at all keep their store order behind the sorted
    // ones rather than being dropped.
    await expect(order.at(-1)).toBe('Nutmeg · Novak');
  },
};

export const ReadOnly: Story = {
  name: 'View-only permissions',
  beforeEach: prepare({ permissions: [PERMISSIONS.COMPANIONS_VIEW_ANY] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');

    // The directory is fully readable - the grant that is missing only removes
    // the ways to change it.
    await expect(rowNames(canvasElement)).toHaveLength(8);

    /* Add is not disabled, it is not rendered. A disabled control at least says
       the action exists; this one leaves no trace, which is the behaviour worth
       pinning because nothing else on the page changes shape. */
    await expect(canvas.queryByRole('button', { name: 'New companion' })).not.toBeInTheDocument();

    await userEvent.click(canvas.getAllByRole('button', { name: 'Companion row actions' })[0]);
    const menu = await waitFor(() => {
      const node = globalThis.document.querySelector<HTMLElement>('[role="menu"]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    /* Two entries, both read-only. Book appointment, Add task and Change status
       are each gated on a separate grant, so the same kebab holds anywhere from
       two to five rows depending on the membership. */
    await expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim())
    ).toEqual(['Open overview', 'View profile']);
  },
};

export const PermissionDenied: Story = {
  name: 'Permission denied',
  /* Reached through a route that declares no permission requirement. On
     /companions it cannot be: `OrgGuard` runs `canAccessPathByPermissions`
     first and redirects a membership without `companions:view:any` away before
     the page mounts - so the `PermissionGate` fallback below is unreachable in
     the product, and this frame is the only place it is visible. */
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/organization' } } },
  beforeEach: prepare({ permissions: [PERMISSIONS.TASKS_EDIT_ANY] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The header is OUTSIDE the gate, so the page still announces eight patients
       and offers the view toggles over a body the reader cannot see. */
    await expect(await canvas.findByText('8 patients, 6 active')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Grid view' })).toBeVisible();

    // The gate's fallback is the compact inline notice, and it names the real
    // membership role rather than a generic "not authorized".
    const notice = canvas.getByRole('status');
    await expect(notice.textContent).toContain("Your role (Front desk) can't view this section.");
    await expect(within(notice).getByRole('button', { name: 'Request access' })).toBeVisible();

    // Nothing under the gate rendered: no tabs, no rows, no filters.
    await expect(canvas.queryAllByRole('tab')).toHaveLength(0);
    await expect(rowNames(canvasElement)).toEqual([]);
    await expect(canvas.queryByText(/^Showing /)).not.toBeInTheDocument();
  },
};

export const AddCompanionDrawer: Story = {
  name: 'Add companion: the shipped panel',
  beforeEach: withRevampFlag(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');

    await userEvent.click(canvas.getByRole('button', { name: 'New companion' }));
    const dialog = await openedDialog();
    const rect = dialog.getBoundingClientRect();
    const viewport = globalThis.document.documentElement.clientWidth;

    /* The centred `md` panel: 680px. Measured rather than matched on a class,
       because both sides of the feature flag open a centred dialog headed "Add
       companion" - the width and the accessible name are the only things that
       tell them apart, so a story that read the title could not say which one it
       had. */
    await expect(Math.round(rect.width)).toBe(680);
    await expect(Math.abs((rect.left + rect.right) / 2 - viewport / 2)).toBeLessThanOrEqual(1);

    /* Named by an `aria-label` that duplicates the visible heading rather than
       pointing at it, so the two can drift apart silently. The revamped panel
       uses `aria-labelledby` instead - see the story below. */
    await expect(dialog).toHaveAttribute('aria-label', 'Add companion');
    await expect(dialog.getAttribute('aria-labelledby')).toBeNull();

    // The legacy flow is a two-step wizard, and the step line is the only thing
    // that says so before the reader commits to it.
    await expect(within(dialog).getByText('Step 1 of 2 · parent details')).toBeVisible();
  },
};

export const AddCompanionRevamped: Story = {
  name: 'Add companion: the revamp flag on',
  beforeEach: withRevampFlag(true),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');

    /* Same button, same page, same title - a completely different panel. The
       directory around it does not change at all, which is why the flag is
       invisible until something is opened. */
    await userEvent.click(canvas.getByRole('button', { name: 'New companion' }));
    const dialog = await openedDialog();
    const rect = dialog.getBoundingClientRect();
    const viewport = globalThis.document.documentElement.clientWidth;

    // 80vw capped at 860 against the 680 of the panel it replaces - a 180px
    // jump in the working area, from one environment variable.
    await expect(Math.round(rect.width)).toBe(860);
    await expect(Math.abs((rect.left + rect.right) / 2 - viewport / 2)).toBeLessThanOrEqual(1);

    /* And the name is wired to the heading rather than copied into an
       `aria-label`, so the two cannot drift. Worth pinning because it is the
       side of the flag that is correct: flipping back regresses it. */
    const labelledBy = dialog.getAttribute('aria-labelledby');
    await expect(labelledBy).not.toBeNull();
    await expect(globalThis.document.getElementById(labelledBy as string)?.textContent).toBe(
      'Add companion'
    );
    await expect(dialog.getAttribute('aria-label')).toBeNull();

    // The two-step wizard line is gone: the revamped panel is one form.
    await expect(
      within(dialog).queryByText('Step 1 of 2 · parent details')
    ).not.toBeInTheDocument();
  },
};

export const DeepLinkedCompanion: Story = {
  name: 'Deep link opens the record',
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/companions', query: { companionId: 'companion-4' } },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('8 patients, 6 active');

    /* The link is honoured during render, not after a click: the page finds the
       companion, makes it active and opens the record. Mango rather than the
       first row, so a modal that simply opened on `companions[0]` would fail
       here. */
    const dialog = await waitFor(() => {
      const node = globalThis.document.querySelector<HTMLElement>('dialog[open]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    await waitFor(() => expect(dialog.textContent).toContain('Mango'));

    /* And the param is dropped from the history entry once it has been acted on.
       Without that rewrite, Back from the overview replays the deep link and the
       record re-opens on a page the reader was trying to return to. */
    await waitFor(() => expect(globalThis.location.search).not.toContain('companionId'));
  },
};

export const Phone: Story = {
  name: 'Phone: cards and the search bar',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert, and the phone branch is a `useIsPhone` media
  // query rather than a CSS breakpoint.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px the table is replaced by a stack of tap-through cards - a different tree, ' +
          'not a restyled one, so the pager is not hidden but absent and every companion renders ' +
          'at once regardless of `PAGE_SIZE`. The search field above the tabs is the phone-only ' +
          '`MobileSearchBar` (`lg:hidden`), writing into the same shared store the desktop shell ' +
          'header uses, and the Add button is `max-md:hidden` because the phone shell puts that ' +
          'action on its floating button instead - which this page opts into with ' +
          '`usePhonePrimaryAction`.\n\n' +
          'Deliberately without a play function: `useIsPhone` reads a real `matchMedia` query, so ' +
          'it needs the manager to resize the preview iframe. A headless run that loads ' +
          '`iframe.html` directly keeps the desktop width and would assert the table while ' +
          'claiming to check the cards.',
      },
    },
  },
};
