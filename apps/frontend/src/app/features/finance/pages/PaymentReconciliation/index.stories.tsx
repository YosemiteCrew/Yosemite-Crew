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
import PaymentReconciliation from './index';

const ORG_ID = 'org-storybook-reconciliation';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

const membership = (revoked: string[] = []): UserOrganization => ({
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

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

/**
 * Synthetic captures covering the states an operator actually has to tell
 * apart: money whose owner is unknown, money attributed but not applied, money
 * partly given back, and money that is settled.
 */
const RECEIPTS = [
  {
    id: 'rec-unattributed',
    provider: 'STRIPE',
    merchantAccountRef: 'acct_harbourside',
    paymentRef: 'pi_3QhZ1mUnattributed',
    organisationId: null,
    invoiceId: null,
    appointmentId: null,
    amount: 84,
    currency: 'GBP',
    capturedAt: '2026-09-12T14:03:00.000Z',
    status: 'UNATTRIBUTED',
    reason: 'No connected account matched the capture',
    refundedAmount: 0,
    version: 1,
    createdAt: '2026-09-12T14:03:05.000Z',
  },
  {
    id: 'rec-unallocated',
    provider: 'STRIPE',
    merchantAccountRef: 'acct_harbourside',
    paymentRef: 'pi_3QhZ2mUnallocated',
    organisationId: ORG_ID,
    invoiceId: null,
    appointmentId: 'apt-4821',
    amount: 132.5,
    currency: 'GBP',
    capturedAt: '2026-09-12T10:41:00.000Z',
    status: 'UNALLOCATED',
    reason: 'The appointment already has a settled invoice',
    refundedAmount: 0,
    version: 1,
    createdAt: '2026-09-12T10:41:04.000Z',
  },
  {
    id: 'rec-partly-refunded',
    provider: 'STRIPE',
    merchantAccountRef: 'acct_harbourside',
    paymentRef: 'pi_3QhZ3mPartly',
    organisationId: ORG_ID,
    invoiceId: 'inv-7714',
    appointmentId: 'apt-4790',
    amount: 210,
    currency: 'GBP',
    capturedAt: '2026-09-11T16:20:00.000Z',
    status: 'PARTIALLY_REFUNDED',
    reason: 'Dental extraction removed from the plan',
    refundedAmount: 45,
    version: 3,
    createdAt: '2026-09-11T16:20:06.000Z',
  },
  {
    id: 'rec-allocated',
    provider: 'STRIPE',
    merchantAccountRef: 'acct_harbourside',
    paymentRef: 'pi_3QhZ4mAllocated',
    organisationId: ORG_ID,
    invoiceId: 'inv-7702',
    appointmentId: 'apt-4776',
    amount: 65,
    currency: 'GBP',
    capturedAt: '2026-09-11T09:12:00.000Z',
    status: 'ALLOCATED',
    reason: null,
    refundedAmount: 0,
    version: 2,
    createdAt: '2026-09-11T09:12:03.000Z',
  },
];

type QueueFixture =
  | { kind: 'resolves'; receipts: typeof RECEIPTS; nextCursor?: string }
  /** Held open on purpose: the only way to hold the loading state still. */
  | { kind: 'pending' }
  | { kind: 'rejects'; message: string };

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const queuePage = (
  config: InternalAxiosRequestConfig,
  receipts: typeof RECEIPTS,
  nextCursor: string | null
) =>
  respond(config, {
    data: receipts,
    meta: { nextCursor, hasMore: nextCursor !== null, limit: 50 },
    error: null,
  });

/**
 * The screen reads `/v1/finance/organisation/:id/provider-receipts` through the
 * shared axios instance, so its adapter is the seam. The status filter and the
 * cursor are honoured here rather than ignored, so pressing a chip or Load more
 * in a play function exercises the real request the page builds.
 */
const buildAdapter =
  (fixture: QueueFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');

    if (url.includes('/provider-receipts')) {
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

      const params = (config.params ?? {}) as { status?: string; cursor?: string };
      if (params.cursor) {
        return Promise.resolve(
          queuePage(
            config,
            [
              {
                ...RECEIPTS[3],
                id: 'rec-second-page',
                paymentRef: 'pi_3QhZ5mSecondPage',
                capturedAt: '2026-09-10T08:55:00.000Z',
                createdAt: '2026-09-10T08:55:02.000Z',
              },
            ],
            null
          )
        );
      }

      const rows = params.status
        ? fixture.receipts.filter((row) => row.status === params.status)
        : fixture.receipts;
      return Promise.resolve(queuePage(config, rows, fixture.nextCursor ?? null));
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
 * The screen ships behind `ProtectedRoute` and `OrgGuard`. The stories satisfy
 * the guards with real data - an authenticated session, a verified org, an
 * active membership, a profile past onboarding step 3 and one availability row -
 * rather than the `NEXT_PUBLIC_DISABLE_AUTH_GUARD` bypass, which only works
 * under the dev server: a static build inlines every `process.env.NEXT_PUBLIC_*`
 * read at build time, so assigning one at runtime changes nothing and the guards
 * redirect.
 */
const prepare =
  ({ fixture, revoked = [] }: { fixture: QueueFixture; revoked?: string[] }) =>
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
 * A refused read is logged by the axios wrapper on its way to the hook's catch,
 * and the render check treats a console error as a broken story. Only that line
 * is dropped; anything else still reaches the console.
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
  title: 'Finance/Payment reconciliation',
  component: PaymentReconciliation,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname; "Back to invoices" is a next/link.
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/payment-reconciliation' } },
    docs: {
      description: {
        component:
          'The reconciliation queue: every card payment the practice has captured, ' +
          'journalled as it landed, whether or not an invoice could be found for it.\n\n' +
          'Read-only by design. Applying a capture to an invoice moves money and is a ' +
          'separate permissioned action, so this screen shows state and never offers a ' +
          'button for something it cannot yet do.\n\n' +
          'Times and the captured-window filter are UTC and labelled as such. The endpoint ' +
          'takes an instant with an offset precisely so nothing is inferred from the ' +
          "reader's device: two staff in different timezones picking the same two dates " +
          'must reconcile the same money. States are shown in words rather than the ' +
          "journal's enum values, and an unattributed capture says it is not linked rather " +
          'than rendering a link with nowhere to go.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare({ fixture: { kind: 'resolves', receipts: RECEIPTS } }),
} satisfies Meta<typeof PaymentReconciliation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Queue: Story = {
  name: 'Captures awaiting reconciliation',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Payment reconciliation' })
    ).toBeVisible();

    const table = within(await canvas.findByRole('table'));
    await expect(table.getByText('12 Sep 2026, 14:03 UTC')).toBeVisible();
    await expect(table.getByText('Unattributed')).toBeVisible();
    // Money with no owner has nowhere to open, and says so.
    await expect(table.getByText('Not linked')).toBeVisible();
    // A partly refunded capture never reads as its full amount alone.
    await expect(table.getByText('£165.00 after £45.00 refunded')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/finance'
    );
  },
};

export const FilteredToUnattributed: Story = {
  name: 'Filtered to money with no owner',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table');

    await userEvent.click(canvas.getByRole('button', { name: 'Unattributed' }));

    await waitFor(async () => {
      const table = within(canvas.getByRole('table'));
      await expect(table.getByText('Unattributed')).toBeVisible();
      await expect(table.queryByText('Allocated')).not.toBeInTheDocument();
    });
  },
};

export const LoadsAnotherPage: Story = {
  name: 'Working further down the queue',
  beforeEach: prepare({
    fixture: { kind: 'resolves', receipts: RECEIPTS, nextCursor: 'cursor-page-2' },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table');

    await userEvent.click(canvas.getByRole('button', { name: 'Load more captured payments' }));

    await waitFor(async () => {
      const table = within(canvas.getByRole('table'));
      // The next page is appended; the first is still there to work down.
      await expect(table.getByText('pi_3QhZ5mSec...')).toBeVisible();
      await expect(table.getByText('pi_3QhZ1mUna...')).toBeVisible();
    });
  },
};

export const Empty: Story = {
  name: 'Nothing captured yet',
  beforeEach: prepare({ fixture: { kind: 'resolves', receipts: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No captured payments yet')).toBeVisible();
    await expect(
      canvas.getByText('Card payments are journalled here as soon as the provider captures them.')
    ).toBeVisible();
  },
};

export const Loading: Story = {
  name: 'Loading the queue',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: 'Payment reconciliation' });
    await expect(await canvas.findByText('Loading captured payments...')).toBeVisible();
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'The queue could not be read',
  beforeEach: [
    prepare({ fixture: { kind: 'rejects', message: 'Reconciliation is unavailable.' } }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    // The server's own wording, with a way to try again.
    await expect(alert).toHaveTextContent('Reconciliation is unavailable.');
    await expect(
      canvas.getByRole('button', { name: 'Retry loading the reconciliation queue' })
    ).toBeEnabled();
  },
};
