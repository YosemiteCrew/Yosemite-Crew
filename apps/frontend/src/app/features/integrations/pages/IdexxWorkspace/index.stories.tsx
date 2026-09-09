import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type {
  CensusEntry,
  LabOrder,
  LabResult,
  OrgIntegration,
} from '@/app/features/integrations/services/types';
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
import IdexxWorkspace from './index';

const ORG_ID = 'org-storybook-idexx';

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

/** Enabled, valid credentials - the state that renders the workspace instead of `NotConnectedState`. */
const IDEXX_INTEGRATION: OrgIntegration = {
  id: 'integration-idexx',
  organisationId: ORG_ID,
  provider: 'IDEXX',
  status: 'enabled',
  credentialsStatus: 'valid',
  lastValidatedAt: '2026-09-08T10:00:00.000Z',
  enabledAt: '2026-06-01T09:00:00.000Z',
  lastSyncAt: '2026-09-09T07:58:00.000Z',
};

const IDEXX_INTEGRATION_DISABLED: OrgIntegration = {
  ...IDEXX_INTEGRATION,
  status: 'disabled',
  credentialsStatus: 'missing',
  enabledAt: null,
  lastSyncAt: null,
};

/**
 * One order, matched to Bramble's result below by `idexxOrderId` <-> `orderId`.
 * That match is what the page reads `appointmentId` through to render the
 * "Open appointment labs" link - it has no appointment id of its own.
 */
const ORDERS: LabOrder[] = [
  {
    _id: 'order-1001',
    organisationId: ORG_ID,
    provider: 'IDEXX',
    companionId: 'pat-bramble',
    appointmentId: 'appt-5041',
    patientName: 'Bramble Fitzgerald',
    status: 'Complete',
    modality: 'REFLAB',
    idexxOrderId: 'IDX-1001',
    uiUrl: null,
    pdfUrl: null,
    tests: ['CHEM17', 'CBC'],
    veterinarian: 'Dr. Weber',
    createdAt: '2026-09-08T08:00:00.000Z',
    updatedAt: '2026-09-09T07:40:00.000Z',
  },
];

/** Three results spanning the three status tones the table draws: success, progress, danger. */
const RESULTS: LabResult[] = [
  {
    _id: 'res-1',
    provider: 'IDEXX',
    resultId: 'RES-9001',
    orderId: 'IDX-1001',
    requisitionId: 'REQ-9001',
    clientId: 'client-1',
    clientFirstName: 'Harriet',
    clientLastName: 'Fitzgerald',
    patientId: 'pat-bramble',
    patientName: 'Bramble Fitzgerald',
    modality: 'REFLAB',
    status: 'Final',
    statusDetail: null,
    accessionId: 'ACC-30045',
    createdAt: '2026-09-08T08:10:00.000Z',
    updatedAt: '2026-09-09T07:42:00.000Z',
    rawPayload: {
      categories: [
        {
          name: 'Chemistry 17 panel',
          tests: [
            {
              name: 'ALT',
              result: '412',
              units: 'U/L',
              referenceRange: '10-100',
              outOfRange: true,
            },
            {
              name: 'Glucose',
              result: '92',
              units: 'mg/dL',
              referenceRange: '70-120',
              outOfRange: false,
            },
          ],
        },
      ],
      runSummaries: [{ id: 'run-1', code: 'CHEM17', name: 'Chemistry 17 panel' }],
    },
  },
  {
    _id: 'res-2',
    provider: 'IDEXX',
    resultId: 'RES-9002',
    orderId: 'IDX-1002',
    requisitionId: 'REQ-9002',
    clientId: 'client-2',
    clientFirstName: 'Priya',
    clientLastName: 'Delacroix',
    patientId: 'pat-saffron',
    patientName: 'Saffron Delacroix',
    modality: 'INHOUSE',
    status: 'Running',
    statusDetail: 'Analyzer in progress',
    accessionId: 'ACC-30046',
    createdAt: '2026-09-09T07:10:00.000Z',
    updatedAt: '2026-09-09T07:15:00.000Z',
    rawPayload: { categories: [], runSummaries: [] },
  },
  {
    _id: 'res-3',
    provider: 'IDEXX',
    resultId: 'RES-9003',
    orderId: 'IDX-1003',
    requisitionId: 'REQ-9003',
    clientId: 'client-3',
    clientFirstName: 'Dominic',
    clientLastName: 'Marchetti',
    patientId: 'pat-otis',
    patientName: 'Otis Marchetti',
    modality: 'REFLAB',
    status: 'Cancelled',
    statusDetail: 'Insufficient sample volume',
    accessionId: 'ACC-30047',
    createdAt: '2026-09-08T06:00:00.000Z',
    updatedAt: '2026-09-08T09:20:00.000Z',
    rawPayload: { categories: [], runSummaries: [] },
  },
];

/** Patient ids line up with the results above, so the census strip and the IVLS Device ID column agree. */
const CENSUS: CensusEntry[] = [
  {
    id: 1,
    patient: {
      patientId: 'pat-bramble',
      name: 'Bramble Fitzgerald',
      speciesCode: 'CANINE',
      client: { firstName: 'Harriet', lastName: 'Fitzgerald' },
    },
    veterinarian: 'Dr. Weber',
    ivls: [{ serialNumber: 'VETLAB-771', displayName: 'VetLab UA' }],
    confirmed: true,
  },
  {
    id: 2,
    patient: {
      patientId: 'pat-saffron',
      name: 'Saffron Delacroix',
      speciesCode: 'FELINE',
      client: { firstName: 'Priya', lastName: 'Delacroix' },
    },
    veterinarian: 'Dr. Osei',
    ivls: [],
    confirmed: false,
  },
  {
    id: 3,
    patient: {
      patientId: 'pat-otis',
      name: 'Otis Marchetti',
      speciesCode: 'CANINE',
      client: { firstName: 'Dominic', lastName: 'Marchetti' },
    },
    veterinarian: 'Dr. Weber',
    ivls: [{ serialNumber: 'CATALYST-118', displayName: 'Catalyst One' }],
    confirmed: true,
  },
];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const rejection = (config: InternalAxiosRequestConfig, message: string, status = 503) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    config,
    response: {
      status,
      statusText: status === 404 ? 'Not Found' : 'Service Unavailable',
      data: { message },
      headers: {},
      config,
    },
  });

type RefreshFixture =
  | { kind: 'resolves'; results: LabResult[]; census: CensusEntry[]; orders: LabOrder[] }
  /** Held open on purpose: the only way to hold the syncing skeleton still. */
  | { kind: 'pending' }
  | { kind: 'rejects'; message: string };

const pathOf = (config: InternalAxiosRequestConfig): string =>
  new URL(String(config.url ?? ''), 'https://yosemite.local').pathname.toLowerCase();

/**
 * The page's own `refresh()` fires three parallel calls on mount - results,
 * census, and an order search - and this fixture answers all three together, so
 * a story can put them in one shared state (loaded / stuck loading / failed)
 * with a single fixture value. The order-by-id, result-by-id, and PDF endpoints
 * a story's play() reaches on demand (order lookup, "Review") always answer
 * from the fixed ORDERS/RESULTS fixtures above instead, since only the
 * "resolves" stories ever click into them.
 */
const buildAdapter =
  (fixture: RefreshFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const path = pathOf(config);
    const method = String(config.method ?? 'get').toLowerCase();

    if (path.endsWith('/idexx/orders/search') && method === 'post') {
      if (fixture.kind === 'pending') return new Promise<never>(() => {});
      if (fixture.kind === 'rejects') return Promise.reject(rejection(config, fixture.message));
      return Promise.resolve(respond(config, fixture.orders));
    }
    if (path.includes('/idexx/orders/')) {
      const orderId = path.split('/').filter(Boolean).pop() ?? '';
      const match = ORDERS.find((order) => order.idexxOrderId.toLowerCase() === orderId);
      return match
        ? Promise.resolve(respond(config, match))
        : Promise.reject(rejection(config, 'Order not found.', 404));
    }
    if (path.endsWith('/idexx/census')) {
      if (fixture.kind === 'pending') return new Promise<never>(() => {});
      if (fixture.kind === 'rejects') return Promise.reject(rejection(config, fixture.message));
      return Promise.resolve(respond(config, fixture.census));
    }
    if (path.endsWith('/pdf')) {
      return Promise.resolve({
        data: new Blob(['%PDF-1.4 fake IDEXX result'], { type: 'application/pdf' }),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }
    if (path.endsWith('/idexx/results')) {
      if (fixture.kind === 'pending') return new Promise<never>(() => {});
      if (fixture.kind === 'rejects') return Promise.reject(rejection(config, fixture.message));
      return Promise.resolve(respond(config, fixture.results));
    }
    if (path.includes('/idexx/results/')) {
      const resultId = path.split('/').filter(Boolean).pop() ?? '';
      const match = RESULTS.find((result) => result.resultId.toLowerCase() === resultId);
      return match
        ? Promise.resolve(respond(config, match))
        : Promise.reject(rejection(config, 'Result not found.', 404));
    }
    if (path.includes('/v1/integration/pms/organisation')) {
      return Promise.resolve(respond(config, [IDEXX_INTEGRATION]));
    }
    if (path.includes('/v1/finance/subscriptions/current')) {
      return Promise.resolve(
        respond(config, { data: { organisationId: ORG_ID, currency: 'GBP' } })
      );
    }
    if (path.includes('/v1/finance/usage-snapshots')) {
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
 * Every org-scoped store OrgGuard loads is seeded with an entry for this org so
 * it short-circuits rather than reaching the network - `useIntegrationStore` is
 * the one exception: it is seeded for real, because IdexxWorkspace itself reads
 * it through `useIntegrationByProviderForPrimaryOrg('IDEXX')` to choose between
 * the workspace and `NotConnectedState`.
 */
const prepare =
  ({
    fixture,
    integration = IDEXX_INTEGRATION,
  }: {
    fixture: RefreshFixture;
    integration?: OrgIntegration | null;
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
    useIntegrationStore.setState({
      integrationIdsByOrgId: { [ORG_ID]: integration ? [integration.id as string] : [] },
      integrationsById: integration ? { [integration.id as string]: integration } : {},
      status: 'loaded',
    });
    useAppointmentStore.setState({
      appointmentIdsByOrgId: emptyIndex,
      appointmentsById: {},
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: {},
      companionsIdsByOrgId: emptyIndex,
      status: 'loaded',
    });
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'GBP' } },
    });
    // The shared header search box writes here; a query left by another story
    // would filter the results list this page reads it against.
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
 * A refused read/write is logged by the axios wrapper on its way to the hook's
 * catch (`API getData error:` for the two GETs, `API postData error:` for the
 * order search POST), and the render check treats a console error as a broken
 * story. Only those two lines are dropped; anything else still reaches the
 * console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some(
        (arg) =>
          typeof arg === 'string' &&
          (arg.includes('API getData error') || arg.includes('API postData error'))
      );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const meta = {
  title: 'Integrations/IdexxWorkspace',
  component: IdexxWorkspace,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname; this is the real route the page is mounted at.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments/idexx-workspace' } },
    docs: {
      description: {
        component:
          "The IDEXX Hub workspace: today's patient census, the lab-results table with " +
          'modality and awaiting-review filters, an order-lookup accordion, and the result ' +
          'detail drawer with its per-test reference-range meter. It fires three IDEXX reads in ' +
          'parallel on mount and every 30s while auto-refresh stays on, and picks between three ' +
          'whole-page shapes on its own rather than by prop: `NotConnectedState` when the org has ' +
          'no enabled IDEXX integration, a syncing skeleton while the first fetch is still in ' +
          'flight, and the workspace once data lands.\n\n' +
          'There is no acknowledgement state for a result yet - the API is read-only and carries ' +
          'none - so "awaiting review" is derived purely from completion: every completed ' +
          'result stays in the queue rather than risking a client-side ack that one vet sees ' +
          'clear while a colleague still sees it queued. A row\'s "Open appointment labs" link ' +
          "only appears when that result's order id is also present among the fetched orders - " +
          'labs are appointment-scoped and this page has no appointment id of its own to link ' +
          'with otherwise.\n\n' +
          'The stories satisfy `ProtectedRoute` + `OrgGuard` with real data - an authenticated ' +
          'session, a verified org, an owner membership, a profile past onboarding step 3 and one ' +
          'availability row - seed every org-scoped store the guard would otherwise load, and ' +
          'answer the IDEXX endpoints from the shared axios adapter. A separate story file, ' +
          '`IdexxWorkspace states`, exercises `NotConnectedState` and the syncing skeleton in ' +
          'isolation at pixel level; the stories here instead prove the real page - guards, ' +
          'stores and all - picks between them correctly.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare({
    fixture: { kind: 'resolves', results: RESULTS, census: CENSUS, orders: ORDERS },
  }),
} satisfies Meta<typeof IdexxWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Connected workspace',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /IDEXX diagnostics/ })
    ).toBeVisible();
    // One completed result (Bramble's), so the subtitle carries a live count.
    await expect(await canvas.findByText('1 results awaiting review')).toBeVisible();

    const censusSection = canvas.getByRole('region', { name: 'Census overview' });
    await expect(within(censusSection).getByText('Bramble Fitzgerald')).toBeVisible();
    await expect(within(censusSection).getByText('Saffron Delacroix')).toBeVisible();
    await expect(within(censusSection).getByText('3 results')).toBeVisible();
    await expect(within(censusSection).getByText('across 3 patients today')).toBeVisible();

    /* Scoped to the desktop table on purpose: the same row also renders inside
       the tablet-pruned table and the phone card list, all three permanently in
       the DOM and swapped by breakpoint CSS rather than by conditional render -
       an unscoped getByText would fail on "multiple elements" at any width. */
    const table = canvas.getByRole('table');
    await expect(within(table).getByText('Bramble Fitzgerald')).toBeVisible();
    await expect(within(table).getByText('ACC-30046')).toBeVisible();
    await expect(within(table).getByText('Cancelled')).toBeVisible();
    // The completed result gets "Review"; the other two get "Details".
    await expect(within(table).getByRole('button', { name: 'Review' })).toBeEnabled();
    await expect(within(table).getAllByRole('button', { name: 'Details' })).toHaveLength(2);
    // Resolved through the fetched order, not carried on the result itself.
    await expect(
      within(table).getByRole('link', { name: 'Open appointment labs for result RES-9001' })
    ).toHaveAttribute(
      'href',
      '/appointments?appointmentId=appt-5041&open=labs&subLabel=idexx-labs'
    );

    // Both accordions default open: patient census and order lookup.
    await expect(canvas.getByRole('button', { name: 'Patient census' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(canvas.getByLabelText('IDEXX order ID')).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Lookup order' })).toBeDisabled();
  },
};

export const ResultDetailOpened: Story = {
  name: 'Reviewing a result opens its detail',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole('table');
    await userEvent.click(within(table).getByRole('button', { name: 'Review' }));

    await waitFor(() => {
      expect(canvasElement.ownerDocument.body.querySelector('dialog[open]')).not.toBeNull();
    });
    const dialog = canvasElement.ownerDocument.body.querySelector('dialog[open]') as HTMLElement;
    const modal = within(dialog);

    // Title is the accession id, not the internal result id.
    await expect(modal.getByText('ACC-30045')).toBeVisible();
    // Loaded via getIdexxResultById, not read off the row that opened it.
    await expect(await modal.findByText('ALT')).toBeVisible();
    await expect(modal.getByText('412 U/L')).toBeVisible();
    await expect(modal.getByText('10-100')).toBeVisible();
    await expect(
      modal.getByRole('link', { name: 'Open appointment labs for result RES-9001' })
    ).toHaveAttribute(
      'href',
      '/appointments?appointmentId=appt-5041&open=labs&subLabel=idexx-labs'
    );
    await expect(modal.getByRole('button', { name: 'Open in appointment labs' })).toBeEnabled();
    await expect(modal.getByRole('button', { name: 'Open results PDF' })).toBeEnabled();
  },
};

export const FiltersNarrowResults: Story = {
  name: 'Modality and awaiting-review filters narrow the table',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole('table');
    await expect(within(table).getByText('Bramble Fitzgerald')).toBeVisible();
    await expect(within(table).getByText('Saffron Delacroix')).toBeVisible();
    await expect(within(table).getByText('Otis Marchetti')).toBeVisible();

    // "Reference Lab" keeps the two REFLAB results and drops the in-house one.
    await userEvent.click(canvas.getByRole('button', { name: 'Reference Lab' }));
    await waitFor(() =>
      expect(within(table).queryByText('Saffron Delacroix')).not.toBeInTheDocument()
    );
    await expect(within(table).getByText('Bramble Fitzgerald')).toBeVisible();
    await expect(within(table).getByText('Otis Marchetti')).toBeVisible();

    // "Awaiting review" narrows further to the one completed result.
    await userEvent.click(canvas.getByRole('button', { name: 'Awaiting review' }));
    await waitFor(() =>
      expect(within(table).queryByText('Otis Marchetti')).not.toBeInTheDocument()
    );
    await expect(within(table).getByText('Bramble Fitzgerald')).toBeVisible();
  },
};

export const NotConnected: Story = {
  name: 'No enabled IDEXX integration',
  beforeEach: prepare({
    fixture: { kind: 'resolves', results: [], census: [], orders: [] },
    integration: IDEXX_INTEGRATION_DISABLED,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("IDEXX isn't connected yet")).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Enable IDEXX in Integrations' })
    ).toHaveAttribute('href', '/integrations');
    await expect(
      canvas.getByText(
        'IDEXX integration availability is currently limited to the USA, Canada, and the UK.'
      )
    ).toBeVisible();
    // Not the results table - nothing was ever fetched for a disabled integration.
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: 'Syncing on first load',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /IDEXX diagnostics/ })
    ).toBeVisible();
    await expect(await canvas.findByText('Syncing with IDEXX…')).toBeVisible();
    // The skeleton replaces the table entirely while nothing has landed yet.
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'Refresh failed',
  beforeEach: [
    prepare({
      fixture: {
        kind: 'rejects',
        message: 'IDEXX Reference Lab service is temporarily unavailable.',
      },
    }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    // The server's own wording, through the shared error-message helper.
    await expect(alert).toHaveTextContent(
      'Unable to load IDEXX Hub data. (503): IDEXX Reference Lab service is temporarily unavailable.'
    );
    // The integration is still enabled, so this is the empty workspace, not the not-connected card.
    await expect(canvas.queryByText("IDEXX isn't connected yet")).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  },
};

export const Phone: Story = {
  name: 'Phone: cards replace the table',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /IDEXX diagnostics/ })
    ).toBeVisible();
    // The table is desktop/tablet only; a phone gets a stacked card per result.
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();

    const reviewButton = await canvas.findByRole('button', { name: 'Review' });
    const card = reviewButton.closest('[class*="rounded-2xl"]') as HTMLElement;
    await expect(within(card).getByText('ACC-30045')).toBeVisible();
    await expect(within(card).getByText('Bramble Fitzgerald')).toBeVisible();

    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
