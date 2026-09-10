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
import { useSearchStore } from '@/app/stores/searchStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import type {
  InsuranceClaim,
  InsuranceClaimStatus,
} from '@/app/features/finance/types/insuranceClaim';
import InsuranceClaims from './index';

// Deliberately doesn't contain the literal "insurance-claims": the list
// endpoint is /organisation/<org>/insurance-claims, and an org id containing
// that same substring makes the adapter's own list-vs-single-claim regex
// match on the wrong occurrence of it.
const ORG_ID = 'org-storybook-harbourside';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/** Every shipped role carries `billing:view:any`/`billing:edit:any` by default. */
const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

/**
 * Enough of a profile and one published availability day to clear
 * `computeTeamOnboardingStep` - below step 3 `OrgGuard` redirects the whole
 * route to /team-onboarding, so an incomplete fixture renders no story at all
 * rather than a worse one. Same fixture `Discounts/index.stories.tsx` uses for
 * the same two guards.
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

const companion = (id: string, name: string): StoredCompanion => ({
  id,
  organisationId: ORG_ID,
  parentId: `parent-${id}`,
  name,
  type: 'dog',
  breed: 'Mixed breed',
  dateOfBirth: new Date(2020, 5, 12),
  gender: 'female',
  isInsured: true,
});

const COMPANIONS: StoredCompanion[] = [
  companion('pat-1', 'Marnie Whitlock'),
  companion('pat-2', 'Rufus Delacroix'),
];

const claim = (
  overrides: Partial<InsuranceClaim> & { id: string; status: InsuranceClaimStatus }
): InsuranceClaim => ({
  organisationId: ORG_ID,
  patientId: 'pat-1',
  invoiceId: null,
  encounterId: null,
  insurerName: 'Petsure',
  policyNumber: 'PS-2291',
  claimNumber: null,
  submittedAmount: 420,
  approvedAmount: null,
  paidAmount: null,
  currency: 'GBP',
  submittedAt: null,
  approvedAt: null,
  paidAt: null,
  rejectionReason: null,
  notes: null,
  externalClaimRef: null,
  createdAt: '2026-08-28T09:00:00.000Z',
  updatedAt: '2026-08-28T09:00:00.000Z',
  ...overrides,
});

const CLAIMS: InsuranceClaim[] = [
  claim({
    id: 'c1',
    status: 'DRAFT',
    patientId: 'pat-1',
    insurerName: 'Petsure',
    policyNumber: 'PS-2291',
  }),
  claim({
    id: 'c2',
    status: 'SUBMITTED',
    patientId: 'pat-2',
    insurerName: 'Bought By Many',
    policyNumber: 'BBM-8841',
    claimNumber: 'CLM-5567',
    submittedAmount: 199.5,
    submittedAt: '2026-08-29T10:00:00.000Z',
  }),
];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

type ListFixture = { kind: 'resolves'; claims: InsuranceClaim[] } | { kind: 'pending' };

/**
 * The container reads and writes `/v1/pms/organisation/:id/insurance-claims`
 * through the shared axios instance. A mutable `claims` array behind the
 * closure lets `submit`/`cancel` answer with the row they just changed, the
 * same round trip the container's `upsert` expects back.
 */
const buildAdapter = (fixture: ListFixture): AxiosAdapter => {
  let claims = fixture.kind === 'resolves' ? [...fixture.claims] : [];

  return (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();
    if (!url.includes('/insurance-claims')) return Promise.resolve(respond(config, []));

    if (method === 'get' && !url.match(/insurance-claims\/[^/]+$/)) {
      if (fixture.kind === 'pending') return new Promise<never>(() => {});
      return Promise.resolve(respond(config, claims));
    }
    if (method === 'post' && url.endsWith('/submit')) {
      const id = url.split('/').at(-2) ?? '';
      claims = claims.map((c) =>
        c.id === id
          ? { ...c, status: 'SUBMITTED' as const, submittedAt: '2026-09-10T09:00:00.000Z' }
          : c
      );
      return Promise.resolve(
        respond(
          config,
          claims.find((c) => c.id === id)
        )
      );
    }
    if (method === 'post' && url.endsWith('/cancel')) {
      const id = url.split('/').at(-2) ?? '';
      claims = claims.map((c) => (c.id === id ? { ...c, status: 'CANCELLED' as const } : c));
      return Promise.resolve(
        respond(
          config,
          claims.find((c) => c.id === id)
        )
      );
    }
    return Promise.resolve(respond(config, []));
  };
};

const REAL_ADAPTER = api.defaults.adapter;

/**
 * The page ships behind `ProtectedRoute` and `OrgGuard`, same as
 * `Discounts/index.tsx`. The stories satisfy both with real data - an
 * authenticated session, a verified org, an active membership, a profile past
 * onboarding step 3 and one availability row - and seed every other
 * org-scoped store OrgGuard's loaders would otherwise reach the network for.
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
    useSearchStore.getState().clear();
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

const meta = {
  title: 'Finance/InsuranceClaims (page)',
  component: InsuranceClaims,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/insurance-claims' } },
    docs: {
      description: {
        component:
          'The Insurance claims page container: fetches the org’s claims through ' +
          '`useInsuranceClaims`, narrows them by the shared search-store query, resolves the ' +
          'empty-state copy, and wires the submit/cancel/create actions to the insurance-claim ' +
          'service. The presentational rendering this hands off to is exercised on its own in ' +
          '`InsuranceClaims.stories.tsx`; what only this file can prove is the container’s own ' +
          'logic - the search filter, the empty-message branches and the real request/response ' +
          'round trip behind each action.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: prepare({ fixture: { kind: 'resolves', claims: CLAIMS } }),
} satisfies Meta<typeof InsuranceClaims>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Claims loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /Insurance claims/ })
    ).toBeVisible();
    await expect(canvas.getByText('(2)')).toBeVisible();
    await expect(canvas.getByText('Petsure')).toBeVisible();
    await expect(canvas.getByText('Bought By Many')).toBeVisible();
  },
};

export const SearchFilter: Story = {
  name: 'Search-store query narrows the list',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Petsure');

    // The search box itself lives in the shared finance header outside this
    // component's own tree; the container only reads the store it writes to.
    useSearchStore.getState().setQuery('bought by many');

    await waitFor(() => expect(canvas.queryByText('Petsure')).not.toBeInTheDocument());
    await expect(canvas.getByText('Bought By Many')).toBeVisible();

    useSearchStore.getState().setQuery('no clinic matches this');
    await expect(await canvas.findByText('No claim matches that search.')).toBeVisible();
  },
};

export const SubmitClaim: Story = {
  name: 'Submitting a draft claim',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Open the claim for Petsure' })
    );
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Submit this claim to the insurer' })
    );

    // The detail panel's own action set flips once the mocked adapter's
    // response lands and the container upserts it back into the list: a
    // submitted claim can no longer be (re-)submitted, but it can now be
    // cancelled - proving the upsert landed the new status, not just that
    // the click handler fired.
    await waitFor(() =>
      expect(
        canvas.queryByRole('button', { name: 'Submit this claim to the insurer' })
      ).not.toBeInTheDocument()
    );
    await expect(canvas.getByRole('button', { name: 'Cancel this claim' })).toBeVisible();
    // The badge's own text is title case; a CSS uppercase transform is what
    // makes it READ as "SUBMITTED" on screen.
    await expect(canvas.getAllByText('Submitted').length).toBeGreaterThan(0);
  },
};

export const Empty: Story = {
  name: 'No claims at all',
  beforeEach: prepare({ fixture: { kind: 'resolves', claims: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No insurance claims yet')).toBeVisible();
    await expect(
      canvas.getByText('File a claim to recover a treatment cost from a pet parent’s insurer.')
    ).toBeVisible();
  },
};
