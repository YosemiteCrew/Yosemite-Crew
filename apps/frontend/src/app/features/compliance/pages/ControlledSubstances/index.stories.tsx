import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
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
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import type {
  ControlledSubstanceLog,
  CreateControlledSubstanceLogInput,
} from '@/app/features/compliance/types/controlledSubstance';
import ControlledSubstances from './index';

const ORG_ID = 'org-storybook-controlled-substances';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/**
 * OWNER carries both `controlled-drug-register:read` and `:record` by
 * default, so the read-only story is only reachable through
 * `revokedPermissions` - which is also how a practice really takes recording
 * rights off one person while leaving the register itself visible.
 */
const membership = (revoked: string[] = []): UserOrganization => ({
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

type LogsFixture =
  | { kind: 'resolves'; logs: ControlledSubstanceLog[] }
  /** Held open on purpose: the only way to hold the skeleton still. */
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

const entry = (overrides: Partial<ControlledSubstanceLog>): ControlledSubstanceLog => ({
  id: 'log-1',
  organisationId: ORG_ID,
  patientId: null,
  encounterId: null,
  loggedAt: '2026-09-03T14:30:00.000Z',
  drug: 'Ketamine',
  deaSchedule: 'III',
  lotNumber: null,
  strength: null,
  unit: 'ML',
  amountDrawn: 1,
  amountAdministered: 1,
  amountWasted: 0,
  wastedWitness: null,
  balanceBefore: null,
  balanceAfter: null,
  administeredBy: null,
  notes: null,
  createdAt: '2026-09-03T14:31:00.000Z',
  updatedAt: '2026-09-03T14:31:00.000Z',
  ...overrides,
});

const LOGS: ControlledSubstanceLog[] = [
  entry({
    id: 'log-1',
    drug: 'Fentanyl citrate',
    deaSchedule: 'II',
    unit: 'ML',
    strength: 0.05,
    amountDrawn: 2,
    amountAdministered: 1.5,
    amountWasted: 0.5,
    wastedWitness: 'Dr. Alvarez',
    balanceBefore: 10,
    balanceAfter: 8,
    administeredBy: 'Dr. Weber',
    notes: 'Premedication before dental.',
  }),
  entry({
    id: 'log-2',
    drug: 'Ketamine',
    deaSchedule: 'III',
    unit: 'MG',
    amountDrawn: 100,
    amountAdministered: 80,
    amountWasted: 20,
    // Compliance red flag: waste with no witness recorded.
    wastedWitness: null,
    balanceBefore: 500,
    balanceAfter: 400,
    administeredBy: 'Dr. Reyes',
  }),
  entry({
    id: 'log-3',
    drug: 'Diazepam',
    deaSchedule: 'IV',
    unit: 'ML',
    strength: 5,
    amountDrawn: 1,
    amountAdministered: 1,
    administeredBy: 'Dr. Weber',
  }),
  entry({
    id: 'log-4',
    drug: 'Phenobarbital',
    deaSchedule: 'V',
    unit: 'TABLET',
    amountDrawn: 3,
    amountAdministered: 3,
    administeredBy: 'Dr. Reyes',
  }),
];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * The page lists and creates through
 * `/v1/pms/organisation/:id/controlled-substance-logs`, both through the
 * shared axios instance, so its adapter is the seam. A POST is echoed back as
 * the row the server would store - `administeredBy` stamped server-side, never
 * taken from the request body, matching `controlled-substance-log.controller.ts`.
 * `OrgGuard` itself (not this page) calls the two finance endpoints below on
 * every route via `useLoadSubscriptionCounterForPrimaryOrg`, so they are
 * answered too rather than left to reject.
 */
const buildAdapter =
  (fixture: LogsFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();

    if (url.includes('/controlled-substance-logs')) {
      if (method === 'post') {
        const body = JSON.parse(String(config.data ?? '{}')) as CreateControlledSubstanceLogInput;
        return Promise.resolve(
          respond(
            config,
            entry({
              id: 'log-new',
              patientId: body.patientId ?? null,
              encounterId: body.encounterId ?? null,
              loggedAt: body.loggedAt,
              drug: body.drug,
              deaSchedule: body.deaSchedule,
              lotNumber: body.lotNumber ?? null,
              strength: body.strength ?? null,
              unit: body.unit,
              amountDrawn: body.amountDrawn,
              amountAdministered: body.amountAdministered,
              amountWasted: body.amountWasted ?? 0,
              wastedWitness: body.wastedWitness ?? null,
              balanceBefore: body.balanceBefore ?? null,
              balanceAfter: body.balanceAfter ?? null,
              administeredBy: 'Dr. Weber',
              notes: body.notes ?? null,
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
              data: { message: fixture.message },
              headers: {},
              config,
            },
          })
        );
      }
      return Promise.resolve(respond(config, fixture.logs));
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
 * `OrgGuard` fires its eleven org-scoped loaders regardless of which page it
 * wraps, so each of their stores is seeded with an entry for this org too, and
 * short-circuits on `Object.hasOwn(...ByOrgId, primaryOrgId)` rather than
 * reaching the network.
 */
const prepare =
  ({ fixture, revoked = [] }: { fixture: LogsFixture; revoked?: string[] }) =>
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
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
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
      companionsById: {},
      companionsIdsByOrgId: emptyIndex,
      status: 'loaded',
    });
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'GBP' } },
    });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useTeamStore.setState(snapshots.team);
      useTaskStore.setState(snapshots.task);
      useSubscriptionStore.setState(snapshots.subscription);
      useSpecialityStore.setState(snapshots.speciality);
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
  title: 'Compliance/ControlledSubstances',
  component: ControlledSubstances,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname.
    nextjs: { appDirectory: true, navigation: { pathname: '/controlled-substances' } },
    docs: {
      description: {
        component:
          'The Controlled Substances page: an auditable log of every controlled-drug draw, ' +
          'administration and waste for the organisation, filtered by drug name and a ' +
          'from/to date range.\n\n' +
          'Entries are listed and created through the compliance controlled-substance-logs ' +
          'endpoint. The date bounds are applied server-side so the register stays correct as ' +
          'an org accumulates entries past what one response holds, while the drug-name filter ' +
          'runs client-side over the returned rows so a keystroke does not fire a request. A ' +
          'waste amount with no witness recorded is flagged inline as a compliance gap rather ' +
          'than silently accepted, and the form itself refuses to save one.\n\n' +
          'The page sits behind `controlled-drug-register:read`, checked both by the route and ' +
          'again by `PermissionGate`; the Add entry action is a separate check behind ' +
          '`controlled-drug-register:record`, so a viewer can read the register without being ' +
          'able to append to it. The stories lift `ProtectedRoute` and `OrgGuard` with real data ' +
          '- an authenticated session, a verified org, an active membership, a profile past ' +
          'onboarding step 3 and one availability row - seed every org-scoped store OrgGuard ' +
          'would otherwise load, and answer the register endpoint from the shared axios adapter.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare({ fixture: { kind: 'resolves', logs: LOGS } }),
} satisfies Meta<typeof ControlledSubstances>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The register renders a phone card list and the desktop table for the same
 * rows at once - Tailwind's `md:hidden` / `hidden md:block` toggles which is
 * visible, both stay mounted - so a drug name matches twice in the DOM.
 * Scoping to the table (named by its `<caption>`) picks the desktop copy.
 */
const findRegisterTable = async (canvasElement: HTMLElement) =>
  within(
    await within(canvasElement).findByRole('table', { name: /controlled substance register/i })
  );

export const Loaded: Story = {
  name: 'Entries in range',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Controlled drug register' })
    ).toBeVisible();

    const table = await findRegisterTable(canvasElement);
    await expect(table.getByText('Fentanyl citrate')).toBeVisible();
    await expect(table.getByText('Ketamine')).toBeVisible();
    await expect(table.getByText('Diazepam')).toBeVisible();
    await expect(table.getByText('Phenobarbital')).toBeVisible();

    // The compliance flag on the row wasted with no witness.
    await expect(table.getByText('Witness missing')).toBeVisible();
    await expect(table.getByText('Witness: Dr. Alvarez')).toBeVisible();

    await expect(
      canvas.getByRole('button', { name: 'Add a controlled substance entry' })
    ).toBeEnabled();
  },
};

export const Empty: Story = {
  name: 'No entries in range',
  beforeEach: prepare({ fixture: { kind: 'resolves', logs: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No controlled substance entries yet.')).toBeVisible();
    await expect(
      canvas.getByText('Log a draw, administration or waste to start the compliance register.')
    ).toBeVisible();
  },
};

export const Loading: Story = {
  name: 'Loading the register',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: 'Controlled drug register' });
    // A pulsing placeholder stands in for the table; no rows, no empty state.
    await waitFor(() => expect(canvasElement.querySelector('.animate-pulse')).not.toBeNull());
    await expect(
      canvas.queryByText('No controlled substance entries yet.')
    ).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'Register could not be loaded',
  beforeEach: [
    prepare({
      fixture: { kind: 'rejects', message: 'The controlled substance register is unavailable.' },
    }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    // The server's own wording, surfaced verbatim.
    await expect(alert).toHaveTextContent('The controlled substance register is unavailable.');
    await expect(canvas.queryByText('Fentanyl citrate')).not.toBeInTheDocument();
  },
};

export const EntryLogged: Story = {
  name: 'Logging a new entry',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Add a controlled substance entry' })
    );

    const form = await canvas.findByRole('form', { name: 'Add controlled substance entry' });
    const withinForm = within(form);
    await userEvent.type(withinForm.getByLabelText('Drug name'), 'Buprenorphine');
    await userEvent.type(withinForm.getByLabelText('Amount drawn'), '2');
    await userEvent.type(withinForm.getByLabelText('Amount administered'), '2');
    await userEvent.click(
      withinForm.getByRole('button', { name: 'Save this controlled substance entry' })
    );

    // The form closes only once the create actually resolves, so its
    // disappearance is the proof the POST round-tripped through the adapter.
    await waitFor(() =>
      expect(
        canvas.queryByRole('form', { name: 'Add controlled substance entry' })
      ).not.toBeInTheDocument()
    );
    const table = await findRegisterTable(canvasElement);
    await expect(table.getByText('Fentanyl citrate')).toBeVisible();
  },
};

export const ReadOnly: Story = {
  name: 'Recording revoked - no Add entry',
  beforeEach: prepare({
    fixture: { kind: 'resolves', logs: LOGS },
    revoked: ['controlled-drug-register:record'],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The register itself is still readable...
    const table = await findRegisterTable(canvasElement);
    await expect(table.getByText('Fentanyl citrate')).toBeVisible();
    // ...but the action to append to it is gone, not merely disabled.
    await expect(
      canvas.queryByRole('button', { name: 'Add a controlled substance entry' })
    ).not.toBeInTheDocument();
  },
};
