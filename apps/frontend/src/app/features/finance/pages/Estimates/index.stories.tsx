import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import type { Estimate, EstimateStatus } from '@/app/features/finance/types/estimate';
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
import { useSearchStore } from '@/app/stores/searchStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Estimates from './index';

const ORG_ID = 'org-storybook-estimates';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const companion = (id: string, name: string, breed: string): StoredCompanion => ({
  id,
  organisationId: ORG_ID,
  parentId: 'parent-1',
  name,
  type: 'dog',
  breed,
  dateOfBirth: new Date(2021, 3, 18),
  gender: 'female',
  isInsured: false,
});

/** The estimates API returns a bare `patientId`; these are what turn it into a name. */
const COMPANIONS: StoredCompanion[] = [
  companion('pat-marnie', 'Marnie Whitlock', 'Beagle'),
  companion('pat-rufus', 'Rufus Delacroix', 'Labrador retriever'),
  companion('pat-pepper', 'Pepper Osei', 'Cocker spaniel'),
];

const item = (
  id: string,
  description: string,
  quantity: number,
  unitPrice: number,
  taxRate: number,
  notes: string | null = null
) => ({ id, description, quantity, unitPrice, taxRate, lineTotal: quantity * unitPrice, notes });

const estimate = (
  id: string,
  patientId: string,
  status: EstimateStatus,
  over: Partial<Estimate> = {}
): Estimate => ({
  id,
  organisationId: ORG_ID,
  patientId,
  encounterId: null,
  status,
  validUntil: '2026-10-01T00:00:00.000Z',
  subtotal: 179.97,
  taxAmount: 11.99,
  total: 191.96,
  currency: 'GBP',
  notes: 'Two-stage dental under general anaesthetic.',
  approvedBy: null,
  approvedAt: null,
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: null,
  createdBy: 'vet-weber',
  createdAt: '2026-08-30T09:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
  items: [
    item('i1', 'Dental scale and polish', 1, 120, 0),
    item('i2', 'Pre-anaesthetic bloods', 3, 19.99, 20, 'Repeat on the day if delayed'),
  ],
  ...over,
});

const ESTIMATES: Estimate[] = [
  estimate('est-1', 'pat-marnie', 'APPROVED', {
    approvedBy: 'vet-weber',
    approvedAt: '2026-09-01T09:00:00.000Z',
  }),
  estimate('est-2', 'pat-rufus', 'DRAFT', {
    subtotal: 45.5,
    taxAmount: 0,
    total: 45.5,
    validUntil: null,
    notes: null,
    items: [item('i3', 'Nail clip and anal gland expression', 1, 45.5, 0)],
  }),
  estimate('est-3', 'pat-pepper', 'CONVERTED', {
    convertedToInvoiceId: 'inv-77',
    subtotal: 1240.6,
    taxAmount: 0,
    total: 1240.6,
    items: [item('i4', 'Cruciate repair (TPLO)', 1, 1240.6, 0)],
  }),
];

type ListFixture =
  | { kind: 'resolves'; estimates: Estimate[] }
  /** Held open on purpose: the only way to hold the list skeleton still. */
  | { kind: 'pending' }
  | { kind: 'rejects'; message: string };

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
  userId: 'user-storybook',
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
  userId: 'user-storybook',
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

/** The status the list asked for, whether axios carried it as `params` or in the URL. */
const requestedStatus = (config: InternalAxiosRequestConfig): string | undefined => {
  const params = (config.params ?? {}) as Record<string, unknown>;
  if (typeof params.status === 'string') return params.status;
  const fromUrl = new URL(String(config.url ?? ''), 'https://yosemite.local').searchParams.get(
    'status'
  );
  return fromUrl ?? undefined;
};

/**
 * `useEstimates` lists through `GET /v1/pms/organisation/:id/estimates`, with
 * the status filter applied server-side; a create POSTs to the same path. Both
 * go through the shared axios instance, so its adapter is the seam. The filter
 * is honoured in the stub because the page's "no estimate has this status"
 * branch only exists when the server answers with an empty list.
 */
const buildAdapter =
  (fixture: ListFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();

    if (url.includes('/estimates')) {
      if (method === 'post') {
        const body = JSON.parse(String(config.data ?? '{}')) as {
          patientId: string;
          notes?: string;
          items: Array<{
            description: string;
            quantity: number;
            unitPrice: number;
            taxRate?: number;
          }>;
        };
        return Promise.resolve(
          respond(
            config,
            estimate('est-new', body.patientId, 'DRAFT', {
              notes: body.notes ?? null,
              validUntil: null,
              items: body.items.map((line, index) =>
                item(
                  `new-${index}`,
                  line.description,
                  line.quantity,
                  line.unitPrice,
                  line.taxRate ?? 0
                )
              ),
            })
          )
        );
      }
      if (fixture.kind === 'pending') return new Promise<never>(() => {});
      if (fixture.kind === 'rejects') {
        return Promise.reject(
          Object.assign(new Error('Request failed with status code 403'), {
            isAxiosError: true,
            config,
            response: {
              status: 403,
              statusText: 'Forbidden',
              data: { error: fixture.message },
              headers: {},
              config,
            },
          })
        );
      }
      const status = requestedStatus(config);
      const rows = status
        ? fixture.estimates.filter((row) => row.status === status)
        : fixture.estimates;
      return Promise.resolve(respond(config, rows));
    }
    if (url.includes('/v1/finance/subscriptions/current')) {
      return Promise.resolve(
        respond(config, { data: { organisationId: ORG_ID, currency: 'GBP' } })
      );
    }
    if (url.includes('/v1/finance/usage-snapshots')) {
      return Promise.resolve(respond(config, { data: [] }));
    }
    return Promise.resolve(respond(config, []));
  };

const REAL_ADAPTER = api.defaults.adapter;

/**
 * The page ships behind `ProtectedRoute` and `OrgGuard`. The stories satisfy the guards with real
 * data - an authenticated session, a verified org, an active membership, a
 * profile past onboarding step 3 and one availability row - rather than with the
 * `NEXT_PUBLIC_DISABLE_AUTH_GUARD` bypass, which only works under the dev server:
 * a static build inlines every `process.env.NEXT_PUBLIC_*` read at build time, so
 * assigning one at runtime changes nothing and the guards redirect.
 *
 *  its eleven
 * org-scoped loaders, and each store is seeded with an entry for this org so
 * they short-circuit rather than reaching the network. Companions are seeded
 * for real: they name every row and populate the create picker.
 */
const prepare =
  ({
    fixture,
    companions = COMPANIONS,
  }: {
    fixture: ListFixture;
    companions?: StoredCompanion[];
  }) =>
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
      room: useOrganisationRoomStore.getState(),
      search: useSearchStore.getState(),
      speciality: useSpecialityStore.getState(),
      subscription: useSubscriptionStore.getState(),
      task: useTaskStore.getState(),
      team: useTeamStore.getState(),
    };
    api.defaults.adapter = buildAdapter(fixture);

    const emptyIndex = { [ORG_ID]: [] as string[] };
    const fetchedAt = { [ORG_ID]: new Date().toISOString() };

    useAuthStore.setState({ status: 'authenticated' });
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
      membershipsByOrgId: { [ORG_ID]: OWNER },
      status: 'loaded',
    });
    useTeamStore.setState({ teamIdsByOrgId: emptyIndex, status: 'loaded' });
    useSpecialityStore.setState({ specialityIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganisationRoomStore.setState({ roomIdsByOrgId: emptyIndex, status: 'loaded' });
    useInvoiceStore.setState({ invoiceIdsByOrgId: emptyIndex, status: 'loaded' });
    useTaskStore.setState({ taskIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganizationDocumentStore.setState({ documentIdsByOrgId: emptyIndex, status: 'loaded' });
    useIntegrationStore.setState({ integrationIdsByOrgId: emptyIndex, status: 'loaded' });
    useAppointmentStore.setState({
      appointmentIdsByOrgId: emptyIndex,
      appointmentsById: {},
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: Object.fromEntries(companions.map((row) => [row.id, row])),
      companionsIdsByOrgId: { [ORG_ID]: companions.map((row) => row.id) },
      status: 'loaded',
    });
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'GBP' } },
    });
    // The shared finance header writes here; a query left by another story would filter this list.
    useSearchStore.setState({ query: '' });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useTeamStore.setState(snapshots.team);
      useTaskStore.setState(snapshots.task);
      useSubscriptionStore.setState(snapshots.subscription);
      useSpecialityStore.setState(snapshots.speciality);
      useSearchStore.setState(snapshots.search);
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

/**
 * A refused list is logged by the axios wrapper on its way to the hook's catch,
 * and the render check treats a console error as a broken story. Only that
 * line is dropped; anything else still reaches the console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some((arg) => typeof arg === 'string' && arg.includes('API getData error'));
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const meta = {
  title: 'Finance/Estimates',
  component: Estimates,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname; "Back to invoices" is a next/link.
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/estimates' } },
    docs: {
      description: {
        component:
          'The Estimates page: a status filter row, the list, the detail card for the ' +
          'selected estimate, and the create dialog behind "New estimate".\n\n' +
          'Three things about it are decided by data. The list is filtered server-side, so a ' +
          'status pill with no members is an empty answer rather than an empty client-side ' +
          'filter, and the empty state names which of three situations it is in - a search ' +
          'that matched nothing, a status with no members, or no estimates at all. Every row ' +
          'is named by resolving the bare `patientId` the API returns against the companion ' +
          'store, and the same companions populate the create picker - so with none loaded, ' +
          '"New estimate" is disabled rather than opening a dialog that can only fail. And the ' +
          'currency comes from the organisation subscription, not from the API, whose own ' +
          'default is GBP whatever the clinic bills in.\n\n' +
          'The stories lift the route guards with the local-only bypass flag the shell ' +
          'honours, seed the org-scoped stores OrgGuard would load, and answer the estimates ' +
          'endpoint from the shared axios adapter - honouring the status filter, and echoing ' +
          'a create back as the DRAFT the server would mint.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare({ fixture: { kind: 'resolves', estimates: ESTIMATES } }),
} satisfies Meta<typeof Estimates>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  name: 'Three estimates',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The title carries a live count - "Estimates (3)" - so it is matched on its
       stem rather than in full, and the count itself is asserted where it means
       something (the row list below). */
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /^Estimates/ })
    ).toBeVisible();

    // Rows are named by companion, resolved from the store rather than printed as ids.
    await expect(
      await canvas.findByRole('button', { name: 'Open the estimate for Marnie Whitlock' })
    ).toBeVisible();
    await expect(canvas.getByText('Rufus Delacroix')).toBeVisible();
    await expect(canvas.getByText('Pepper Osei')).toBeVisible();
    await expect(canvasElement.textContent).not.toContain('pat-marnie');
    // Pennies survive in the list.
    await expect(canvas.getByText('£45.50')).toBeVisible();
    await expect(canvas.getByText('£1,240.60')).toBeVisible();

    await expect(canvas.getByRole('button', { name: 'Create a new estimate' })).toBeEnabled();
    await expect(canvas.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/finance'
    );
    // Nothing selected yet, so no detail card.
    await expect(canvas.queryByText('Dental scale and polish')).not.toBeInTheDocument();
  },
};

export const RowSelected: Story = {
  name: 'Selecting a row opens its detail',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Open the estimate for Marnie Whitlock' })
    );

    // The detail card: lines, the approved-only convert action, and the notes.
    await expect(await canvas.findByText('Dental scale and polish')).toBeVisible();
    await expect(canvas.getByText('Repeat on the day if delayed')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Convert this estimate to an invoice' })
    ).toBeEnabled();
    /* Twice on purpose: the list row and the detail card below it must agree on
       the total, which is the one figure a client approves. */
    await expect(canvas.getAllByText('£191.96')).toHaveLength(2);
  },
};

export const StatusFilterEmpty: Story = {
  name: 'A status with no members',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Open the estimate for Marnie Whitlock' });

    const filters = canvas.getByRole('group', { name: 'Filter estimates by status' });
    await userEvent.click(within(filters).getByRole('button', { name: 'Declined' }));

    // Refetched with `status=DECLINED`, which the stub answers with nothing.
    await expect(await canvas.findByText('No estimate currently has this status.')).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Open the estimate for Marnie Whitlock' })
    ).not.toBeInTheDocument();
  },
};

export const SearchMatchesNothing: Story = {
  name: 'A search that matches nothing',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Open the estimate for Marnie Whitlock' });
    // The shared finance header writes the query into the search store.
    useSearchStore.getState().setQuery('Ziggy');
    await expect(await canvas.findByText('No estimate matches that search.')).toBeVisible();
    await expect(canvas.getByText('No estimates yet')).toBeVisible();
  },
};

export const NoEstimates: Story = {
  name: 'No estimates at all',
  beforeEach: prepare({ fixture: { kind: 'resolves', estimates: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('Create an estimate to quote a treatment plan before it is invoiced.')
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Create a new estimate' })).toBeEnabled();
  },
};

export const Loading: Story = {
  name: 'Loading the list',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: /^Estimates/ });
    await waitFor(() => expect(canvasElement.querySelector('.animate-pulse')).not.toBeNull());
    await expect(canvas.queryByText('No estimates yet')).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'List could not be loaded',
  beforeEach: [
    prepare({
      fixture: { kind: 'rejects', message: 'Estimates are not enabled for this practice.' },
    }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    // The controller's `{ error }` string, verbatim.
    await expect(alert).toHaveTextContent('Estimates are not enabled for this practice.');
    await expect(canvas.getByRole('button', { name: 'Retry loading estimates' })).toBeEnabled();
  },
};

export const NewEstimateDialog: Story = {
  name: 'New estimate opens the editor',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Create a new estimate' }));

    // The dialog portals to document.body; its picker holds the seeded companions.
    const picker = await within(document.body).findByLabelText('Companion');
    await expect(
      within(picker).getByRole('option', { name: 'Marnie Whitlock' })
    ).toBeInTheDocument();
    await expect(within(picker).getByRole('option', { name: 'Pepper Osei' })).toBeInTheDocument();
    await expect(
      within(document.body).getByRole('button', { name: 'Create this estimate' })
    ).toBeEnabled();
  },
};

export const NoCompanions: Story = {
  name: 'No companions loaded - cannot create',
  beforeEach: prepare({ fixture: { kind: 'resolves', estimates: [] }, companions: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No estimates yet');
    // Disabled rather than opening a picker with nothing in it.
    await expect(canvas.getByRole('button', { name: 'Create a new estimate' })).toBeDisabled();
  },
};

export const Phone: Story = {
  name: 'Phone: filter row scrolls sideways inside itself',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Open the estimate for Marnie Whitlock' });
    /* Seven non-shrinking pills exceed a phone's width. They live in their own
       horizontal scroller, so the page itself must not move sideways. */
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await expect(canvas.getByRole('group', { name: 'Filter estimates by status' })).toBeVisible();
  },
};
