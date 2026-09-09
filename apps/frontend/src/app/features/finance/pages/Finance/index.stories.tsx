import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Appointment, Invoice, Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import type { BillingSubscription } from '@/app/features/billing/types/billing';
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
import Finance from './index';

const ORG_ID = 'org-storybook-finance';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Willowbrook Animal Hospital',
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

const appointment = (
  id: string,
  companionName: string,
  parentName: string,
  typeName: string
): Appointment => {
  const patient: Appointment['patient'] = {
    id: `companion-${id}`,
    name: companionName,
    species: 'Dog',
    breed: 'Beagle',
    parent: { id: `parent-${id}`, name: parentName },
  };
  return {
    id,
    organisationId: ORG_ID,
    patient,
    companion: patient,
    appointmentType: { name: typeName },
    appointmentDate: new Date('2026-08-30T09:30:00.000Z'),
    startTime: new Date('2026-08-30T09:30:00.000Z'),
    endTime: new Date('2026-08-30T10:00:00.000Z'),
    timeSlot: '09:30 AM',
    durationMinutes: 30,
    status: 'COMPLETED',
  };
};

const APPOINTMENTS: Appointment[] = [
  appointment('appt-1', 'Biscuit', 'Milo Ferraro', 'Wellness exam'),
  appointment('appt-2', 'Juniper', 'Ava Lindqvist', 'Dental cleaning'),
];

const companion = (id: string, name: string, breed: string): StoredCompanion => ({
  id,
  organisationId: ORG_ID,
  parentId: 'parent-otis',
  name,
  type: 'dog',
  breed,
  dateOfBirth: new Date(2020, 5, 12),
  gender: 'male',
  isInsured: false,
});

/**
 * `pat-otis` backs the third invoice, which was converted from an estimate and
 * so carries a bare `patientId` and no `appointmentId` - the row/card renderers
 * fall back to this store to name it rather than showing "Unlinked invoice".
 */
const COMPANIONS: StoredCompanion[] = [companion('pat-otis', 'Otis Kowalczyk', 'Cocker spaniel')];

/**
 * `paidAt` is `new Date()` at module load rather than a fixed timestamp: the
 * header's "collected this week" figure is a real 7-day window computed against
 * the clock at render time (`computeFinanceMetrics(invoices)`, no injected
 * `now`), so a hardcoded past date would pass today and silently drop out of the
 * window - and out of the story - after a week.
 */
const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-storybook-1',
  organisationId: ORG_ID,
  items: [{ name: 'Wellness exam', quantity: 1, unitPrice: 210, total: 210 }],
  subtotal: 210,
  totalAmount: 210,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'GBP',
  status: 'PAID',
  createdAt: new Date('2026-08-30T10:15:00.000Z'),
  updatedAt: new Date('2026-08-30T10:15:00.000Z'),
  ...over,
});

const INVOICES: Invoice[] = [
  invoice({
    id: 'inv-paid',
    appointmentId: 'appt-1',
    items: [
      { name: 'Wellness exam', quantity: 1, unitPrice: 210, total: 210 },
      { name: 'Heartworm test', quantity: 1, unitPrice: 40, total: 40 },
    ],
    subtotal: 250,
    totalAmount: 250,
    status: 'PAID',
    paidAt: new Date(),
  }),
  invoice({
    id: 'inv-awaiting',
    appointmentId: 'appt-2',
    items: [{ name: 'Dental cleaning', quantity: 1, unitPrice: 180.5, total: 180.5 }],
    subtotal: 180.5,
    totalAmount: 180.5,
    paymentCollectionMethod: 'PAYMENT_LINK',
    status: 'AWAITING_PAYMENT',
  }),
  invoice({
    id: 'inv-converted',
    // Converted from an estimate: a patient but no appointment (#comment above).
    patientId: 'pat-otis',
    items: [{ name: 'Cruciate repair (TPLO)', quantity: 1, unitPrice: 640, total: 640 }],
    subtotal: 640,
    totalAmount: 640,
    depositCollectedAmount: 100,
    status: 'PENDING',
  }),
];

const SUBSCRIPTION: BillingSubscription = {
  orgId: ORG_ID,
  currency: 'GBP',
  canAcceptPayments: true,
  connectChargesEnabled: true,
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

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * Finance itself makes no request of its own - `useInvoicesForPrimaryOrg` is a
 * plain store selector - but something in the guarded shell asks for the
 * subscription/usage endpoints the way Discounts and Estimates observed, so the
 * adapter answers those defensively and echoes anything else back empty rather
 * than letting a real request escape the story.
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
 * membership, a profile past onboarding step 3 and one availability row -
 * rather than with the `NEXT_PUBLIC_DISABLE_AUTH_GUARD` bypass, which only works
 * under the dev server: a static build inlines every `process.env.NEXT_PUBLIC_*`
 * read at build time, so assigning one at runtime changes nothing and the
 * guards redirect.
 *
 * Every org-scoped store OrgGuard's loaders would otherwise reach for is seeded
 * so each short-circuits on `Object.hasOwn(...ByOrgId, primaryOrgId)` rather
 * than hitting the network. Invoices, appointments and companions are seeded
 * for real: Finance reads and renders them directly.
 */
const prepare =
  ({
    invoices = INVOICES,
    subscription = SUBSCRIPTION,
    companions = COMPANIONS,
    revoked = [],
  }: {
    invoices?: Invoice[];
    subscription?: BillingSubscription;
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
      membershipsByOrgId: { [ORG_ID]: { ...OWNER, revokedPermissions: revoked } },
      status: 'loaded',
    });
    useTeamStore.setState({ teamIdsByOrgId: emptyIndex, status: 'loaded' });
    useSpecialityStore.setState({ specialityIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganisationRoomStore.setState({ roomIdsByOrgId: emptyIndex, status: 'loaded' });
    useTaskStore.setState({ taskIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganizationDocumentStore.setState({ documentIdsByOrgId: emptyIndex, status: 'loaded' });
    useIntegrationStore.setState({ integrationIdsByOrgId: emptyIndex, status: 'loaded' });
    useAppointmentStore.getState().setAppointmentsForOrg(ORG_ID, APPOINTMENTS);
    useCompanionStore.setState({
      companionsById: Object.fromEntries(companions.map((row) => [row.id, row])),
      companionsIdsByOrgId: { [ORG_ID]: companions.map((row) => row.id) },
      status: 'loaded',
    });
    useInvoiceStore.getState().setInvoicesForOrg(ORG_ID, invoices);
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });
    useSubscriptionStore.setState({ subscriptionByOrgId: { [ORG_ID]: subscription } });
    // The shared search bar writes here; a query left by another story would filter this list.
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

const meta = {
  title: 'Finance/Finance',
  component: Finance,
  parameters: {
    layout: 'fullscreen',
    // OrgGuard and ProtectedRoute both read usePathname.
    nextjs: { appDirectory: true, navigation: { pathname: '/finance' } },
    docs: {
      description: {
        component:
          'The finance landing page: the invoice ledger, its status filter, the "collected this ' +
          'week / outstanding" header figures, and the Stripe connection state, in one of two ' +
          'layouts picked by `useIsPhone` - a responsive table with a phone card list swapped in ' +
          'below.\n\n' +
          'Nothing here fetches. `useInvoicesForPrimaryOrg` and `useSubscriptionForPrimaryOrg` are ' +
          'plain Zustand selectors, so the page renders whatever the store already holds; loading ' +
          "is someone else's effect. The header total only carries a currency when every invoice " +
          'agrees on one (`sharedCurrency`) - a mixed-currency org sees the fallback instead of a ' +
          'total that quietly mislabels itself. An invoice converted from an estimate carries a ' +
          'bare `patientId` and no appointment, so its row and card fall back to the companion ' +
          'store to name it rather than reading "Unlinked invoice".\n\n' +
          'The page sits behind `billing:view:any`; the "Connect Stripe" banner and the Stripe ' +
          'settings link both need `org:edit` + `subscription:edit:any` on top. The stories lift ' +
          'the route guards with real data - an authenticated session, a verified org, an active ' +
          'membership, a profile past onboarding, one availability row - rather than the dev-only ' +
          'bypass flag, and seed every org-scoped store OrgGuard would otherwise load, including ' +
          'real invoices, appointments and companions.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare(),
} satisfies Meta<typeof Finance>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  name: 'Three invoices across statuses',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1, name: /^Finance/ })).toBeVisible();
    await expect(canvas.getByText('Finance (3)')).toBeVisible();

    // One PAID invoice paid just now, so the whole of it is "this week".
    // The other two are unsettled, so their totals (minus any deposit) sum
    // into "outstanding": £180.50 + (£640 - £100 deposit) = £720.50.
    await expect(
      canvas.getByText('£250.00 collected this week · £720.50 outstanding')
    ).toBeVisible();

    await expect(canvas.getByRole('link', { name: 'View estimates' })).toHaveAttribute(
      'href',
      '/finance/estimates'
    );
    await expect(canvas.getByRole('link', { name: 'Manage discounts' })).toHaveAttribute(
      'href',
      '/finance/discounts'
    );
    await expect(canvas.getByRole('link', { name: 'View insurance claims' })).toHaveAttribute(
      'href',
      '/finance/insurance-claims'
    );

    // Charges are enabled and this role can manage Stripe, so the pill is the
    // settings link rather than the plain "connected" badge.
    await expect(canvas.getByRole('link', { name: 'Stripe settings' })).toHaveAttribute(
      'href',
      `/stripe-onboarding?orgId=${ORG_ID}`
    );
    // The banner only shows when payments are NOT yet accepted.
    await expect(
      canvas.queryByRole('heading', { name: 'Connect Stripe account' })
    ).not.toBeInTheDocument();

    await expect(canvas.getByRole('group', { name: 'Filter invoices by status' })).toBeVisible();

    // One row per invoice, named by its own id rather than a shared label.
    await expect(canvas.getByRole('button', { name: 'View invoice inv-paid' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'View invoice inv-awaiting' })).toBeVisible();
    // The estimate-converted invoice is named from the companion store fallback.
    await expect(canvas.getByRole('button', { name: 'View invoice inv-converted' })).toBeVisible();
    await expect(canvas.getByText('Otis Kowalczyk')).toBeVisible();
  },
};

export const ConnectStripeBanner: Story = {
  name: 'Payments not yet connected',
  beforeEach: prepare({
    subscription: { orgId: ORG_ID, currency: 'GBP', canAcceptPayments: false },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = await canvas.findByRole('link', { name: 'Connect Stripe account' });
    await expect(banner).toHaveAttribute('href', `/stripe-onboarding?orgId=${ORG_ID}`);
    await expect(
      canvas.getByText('Connect Stripe before you start receiving card payments from pet parents.')
    ).toBeVisible();
    // Charges are not enabled, so the header pill has nothing to show.
    await expect(canvas.queryByRole('link', { name: 'Stripe settings' })).not.toBeInTheDocument();
    await expect(canvas.queryByText('Stripe · connected')).not.toBeInTheDocument();
  },
};

export const NoInvoices: Story = {
  name: 'No invoices yet',
  beforeEach: prepare({ invoices: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Finance (0)')).toBeVisible();
    await expect(canvas.getByText('£0.00 collected this week · £0.00 outstanding')).toBeVisible();
    // Both table bands render the same empty copy; only one is visible at this
    // width, but the text itself exists in each.
    await expect(canvas.getAllByText('No invoices yet').length).toBeGreaterThan(0);
    await expect(
      canvas.queryByRole('button', { name: 'View invoice inv-paid' })
    ).not.toBeInTheDocument();
  },
};

export const StatusFilterPaid: Story = {
  name: 'Filtering to one status',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'View invoice inv-paid' });

    const filters = canvas.getByRole('group', { name: 'Filter invoices by status' });
    await userEvent.click(within(filters).getByRole('button', { name: 'Paid' }));

    await expect(canvas.getByRole('button', { name: 'View invoice inv-paid' })).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'View invoice inv-awaiting' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'View invoice inv-converted' })
    ).not.toBeInTheDocument();
    // The header total is unfiltered - it still sums every invoice, not just
    // the visible rows.
    await expect(canvas.getByText('Finance (3)')).toBeVisible();
  },
};

export const NoBillingAccess: Story = {
  name: 'Billing view revoked',
  beforeEach: prepare({ revoked: ['billing:view:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/Your role \(Owner\) can.t view this section\./)
    ).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'View invoice inv-paid' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('group', { name: 'Filter invoices by status' })
    ).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: KPI tiles and cards',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Collected · wk')).toBeVisible();
    await expect(canvas.getByText('£250.00')).toBeVisible();
    await expect(canvas.getByText('Outstanding')).toBeVisible();
    await expect(canvas.getByText('£720.50')).toBeVisible();

    // The desktop nav row's Estimates/Discounts/Insurance links have a phone
    // equivalent up top; without it there is no route to /finance/estimates
    // anywhere in the app on a phone.
    await expect(canvas.getByRole('link', { name: 'View estimates' })).toHaveAttribute(
      'href',
      '/finance/estimates'
    );

    await expect(canvas.getByRole('button', { name: 'View invoice inv-paid' })).toBeVisible();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
