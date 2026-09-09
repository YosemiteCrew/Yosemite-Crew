import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type {
  DispenseRequestApi,
  DispenseRequestStatus,
} from '@/app/features/inventory/services/dispensaryService';
import type {
  InventoryItem,
  InventoryTurnoverItem,
} from '@/app/features/inventory/pages/Inventory/types';
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
import Inventory from './index';

const ORG_ID = 'org-storybook-inventory';

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

/** Builds a realistic HOSPITAL catalog row. `stockHealth` is set explicitly
 * rather than left to derive from stock/expiry math - `displayStatusLabel`
 * reads the explicit value first, so this is what the table, the card and the
 * subtitle counts actually key off. */
const buildItem = (
  id: string,
  name: string,
  overrides: Partial<InventoryItem> = {}
): InventoryItem => ({
  id,
  organisationId: ORG_ID,
  businessType: 'HOSPITAL',
  currency: 'GBP',
  status: 'ACTIVE',
  stockHealth: 'HEALTHY',
  sku: `SKU-${id}`,
  basicInfo: {
    name,
    category: 'Medicine',
    subCategory: 'Antibiotic',
    department: 'Pharmacy',
    description: '',
    status: 'Active',
    visibleInInventory: true,
  },
  classification: {},
  pricing: { purchaseCost: '8', selling: '14' },
  vendor: {
    supplierName: 'VetSupply Co',
    brand: '',
    vendor: 'VetSupply Co',
    license: '',
    paymentTerms: 'Net 30',
  },
  stock: {
    current: '120',
    allocated: '10',
    available: '110',
    reorderLevel: '20',
    reorderQuantity: '50',
    stockLocation: 'Pharmacy',
    abcClass: 'Class A',
  },
  batch: {
    batch: 'B-2026-01',
    manufactureDate: '2026-01-01',
    expiryDate: '2027-01-01',
  },
  ...overrides,
});

const CATALOG_ITEMS: InventoryItem[] = [
  buildItem('item-amoxicillin', 'Amoxicillin 250mg'),
  buildItem('item-gauze', 'Surgical gauze pads', {
    stockHealth: 'LOW_STOCK',
    basicInfo: {
      name: 'Surgical gauze pads',
      category: 'Surgical supply',
      subCategory: 'Suture',
      department: 'Pharmacy',
      description: '',
      status: 'Active',
      visibleInInventory: true,
    },
    stock: {
      current: '15',
      allocated: '5',
      available: '10',
      reorderLevel: '20',
      reorderQuantity: '40',
      stockLocation: 'Surgery',
      abcClass: 'Class B',
    },
  }),
  buildItem('item-rabies', 'Rabies vaccine', {
    stockHealth: 'EXPIRED',
    basicInfo: {
      name: 'Rabies vaccine',
      category: 'Vaccine',
      subCategory: 'Rabies',
      department: 'Pharmacy',
      description: '',
      status: 'Active',
      visibleInInventory: true,
    },
    batch: {
      batch: 'B-2025-04',
      manufactureDate: '2024-10-01',
      expiryDate: '2025-01-01',
    },
  }),
];

const TURNOVER_ITEMS: InventoryTurnoverItem[] = [];

const buildDispenseRequest = (
  id: string,
  status: DispenseRequestStatus,
  overrides: Partial<DispenseRequestApi> = {}
): DispenseRequestApi => ({
  id,
  prescriptionId: `rx-${id}`,
  organisationId: ORG_ID,
  status,
  medications: [
    {
      inventoryItemId: 'item-amoxicillin',
      inventoryItemName: 'Amoxicillin 250mg',
      quantity: 2,
      priceCents: 1400,
      fulfillment: 'PATIENT',
    },
  ],
  metadata: null,
  patientName: 'Biscuit',
  parentName: 'Jamie Okafor',
  petBreed: 'Beagle',
  petAge: '4y',
  patientImageUrl: null,
  leadName: 'Dr. Weber',
  location: 'Pharmacy',
  invoiceId: null,
  paymentStatus: null,
  currency: 'GBP',
  requestedBy: 'vet-weber',
  reviewedBy: null,
  requestedAt: '2026-09-08T09:00:00.000Z',
  reviewedAt: null,
  createdAt: '2026-09-08T09:00:00.000Z',
  updatedAt: '2026-09-08T09:00:00.000Z',
  prescription: {
    id: `rx-${id}`,
    artifactId: `artifact-${id}`,
    artifact: {
      id: `artifact-${id}`,
      kind: 'PRESCRIPTION',
      status: 'ACTIVE',
      appointmentId: 'appt-1',
      summary: 'Amoxicillin course',
    },
  },
  ...overrides,
});

const DISPENSE_REQUESTS: DispenseRequestApi[] = [
  buildDispenseRequest('req-1', 'PENDING'),
  buildDispenseRequest('req-2', 'DISPENSED', {
    patientName: 'Whiskers',
    parentName: 'Alex Chen',
    petBreed: 'Domestic shorthair',
    petAge: '2y',
    reviewedAt: '2026-09-08T10:15:00.000Z',
    medications: [
      {
        inventoryItemId: 'item-gauze',
        inventoryItemName: 'Surgical gauze pads',
        quantity: 1,
        priceCents: 500,
        fulfillment: 'IN_HOUSE',
      },
    ],
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
 * Everything the CATALOG itself shows comes straight out of `useInventoryStore`
 * (each story seeds `itemsById`/`itemIdsByOrgId`/`statusByOrgId` directly, the
 * same way the real store looks once `useInventoryModule` has loaded it), so the
 * adapter only has to answer the calls the page makes on top of that: the
 * dispensary request list, the low-stock/expiring alert panel, and the two
 * calls OrgGuard's subscription loader makes. Nothing else should reach the
 * network; the catch-all below keeps any stray call from throwing instead of
 * silently doing nothing.
 */
const buildAdapter = (): AxiosAdapter => (config: InternalAxiosRequestConfig) => {
  const url = String(config.url ?? '');

  if (url.includes('/prescription-dispense-requests')) {
    return Promise.resolve(respond(config, DISPENSE_REQUESTS));
  }
  if (url.includes('/alerts/low-stock') || url.includes('/alerts/expiring')) {
    return Promise.resolve(respond(config, []));
  }
  if (url.includes('/v1/finance/subscriptions/current')) {
    return Promise.resolve(respond(config, { data: { organisationId: ORG_ID, currency: 'GBP' } }));
  }
  if (url.includes('/v1/finance/usage-snapshots')) {
    return Promise.resolve(respond(config, { data: [] }));
  }
  return Promise.resolve(respond(config, []));
};

const REAL_ADAPTER = api.defaults.adapter;

type InventoryFixture = {
  items?: InventoryItem[];
  inventoryStatus?: 'loaded' | 'loading' | 'error';
  inventoryError?: string | null;
};

/**
 * The page ships behind `ProtectedRoute` and `OrgGuard`, and `OrgGuard` itself
 * calls `useInventoryModule` and ten other org-scoped loaders regardless of
 * which page it wraps - so every store those loaders touch is seeded here with
 * real data (an authenticated session, a verified org, an active OWNER
 * membership, a profile past onboarding step 3, one availability row, and an
 * empty index for every org-scoped list) rather than with the
 * `NEXT_PUBLIC_DISABLE_AUTH_GUARD` bypass, which only works under the dev
 * server: a static build inlines every `process.env.NEXT_PUBLIC_*` read at
 * build time, so assigning one at runtime is a no-op and the guards redirect.
 *
 * The catalog itself is seeded straight into `useInventoryStore` with
 * `lastFetchedByOrgId` already set, so `useInventoryModule`'s own effect sees
 * data as already loaded and never reaches for the network - the same state the
 * real store is in after a normal load. Dispensary records are different: the
 * page fetches them itself into local state on every mount, so those come from
 * the axios adapter instead.
 */
const prepare =
  (fixture: InventoryFixture = {}) =>
  () => {
    const { items = CATALOG_ITEMS, inventoryStatus = 'loaded', inventoryError = null } = fixture;
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
      companionsById: {},
      companionsIdsByOrgId: emptyIndex,
      status: 'loaded',
    });
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'GBP' } },
    });
    // The shared header writes here; a query left by another story would filter the catalog.
    useSearchStore.setState({ query: '' });

    useInventoryStore.setState({
      itemsById: Object.fromEntries(items.map((item) => [item.id as string, item])),
      itemIdsByOrgId: { [ORG_ID]: items.map((item) => item.id as string) },
      turnoverByOrgId: { [ORG_ID]: TURNOVER_ITEMS },
      statusByOrgId: { [ORG_ID]: inventoryStatus },
      errorByOrgId: { [ORG_ID]: inventoryError },
      // A 'loading' fixture leaves this unset so `useInventoryModule`'s effect
      // does not think a load already finished - it never fires a fetch anyway
      // while status is 'loading', so the story holds still on purpose.
      lastFetchedByOrgId: inventoryStatus === 'loading' ? {} : fetchedAt,
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

const inventoryMeta = {
  title: 'Inventory/Inventory',
  component: Inventory,
  parameters: {
    layout: 'fullscreen',
    // OrgGuard and the "Back to invoices"-style links read usePathname.
    nextjs: { appDirectory: true, navigation: { pathname: '/inventory' } },
    docs: {
      description: {
        component:
          "The inventory page: a three-way view over one organisation's stock - a paginated " +
          'Catalog table, a Dispensary queue of prescription requests waiting to be pulled from ' +
          'stock, and a Turnover analytics view - plus the low-stock/expiring alerts panel, the ' +
          'add-item and item-detail modals, and a phone-only card catalog below the 768px ' +
          'breakpoint.\n\n' +
          'Stock health is shown from whichever source is more specific: an explicit ' +
          '`stockHealth` on the item when the backend has computed one, otherwise a value ' +
          'derived from batch expiry and reorder level. The catalog and the low-stock alert count ' +
          'agree on the same predicate for "below reorder point" (LOW_STOCK or OUT_OF_STOCK), so ' +
          'the two never disagree about how many items need attention.\n\n' +
          'The page sits behind `inventory:view:any`, and the Dispensary tab and its Dispense ' +
          'action are hidden unless the membership also carries `prescription:view:any` / ' +
          '`prescription:edit:any` - the seeded OWNER role carries all of them. The stories seed ' +
          'the catalog straight into the inventory store (the same state it is in once a real ' +
          'load finishes, so no network call is needed to show it), seed every other org-scoped ' +
          'store OrgGuard loads, and answer the dispensary and alerts endpoints from the shared ' +
          'axios adapter.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare(),
} satisfies Meta<typeof Inventory>;

export default inventoryMeta;
type InventoryStory = StoryObj<typeof inventoryMeta>;

export const Default: InventoryStory = {
  name: 'Catalog with mixed stock health',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The count lives in its own <span> next to the title, not in one text node
    // with it - "3" is checked below via the subtitle counts and the visible rows.
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /^Inventory/ })
    ).toBeVisible();
    // One low-stock row and one expired batch, counted the same way the alert panel counts them.
    await expect(canvas.getByText('1 item below reorder point · 1 expired batch')).toBeVisible();

    await expect(canvas.getByRole('button', { name: 'View Amoxicillin 250mg' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Restock Surgical gauze pads' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'New product' })).toBeEnabled();

    // Catalog / Dispensary / Turnover, in that order.
    await expect(canvas.getByRole('group', { name: 'Inventory view' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Catalog' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  },
};

export const EmptyCatalog: InventoryStory = {
  name: 'No items in the catalog',
  beforeEach: prepare({ items: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: /^Inventory/ });
    await expect(canvas.getByText('0 items below reorder point · 0 expired batches')).toBeVisible();
    // The empty state renders once for the table layout and once for the card
    // layout (CSS picks one per breakpoint), so it is asserted as "at least one".
    await expect((await canvas.findAllByText('No items yet')).length).toBeGreaterThan(0);
    await expect(canvas.queryByRole('button', { name: /^View / })).not.toBeInTheDocument();
  },
};

export const LoadingCatalog: InventoryStory = {
  name: 'Loading the catalog',
  beforeEach: prepare({ items: [], inventoryStatus: 'loading' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: /^Inventory/ });
    await expect(canvas.getByText('Loading inventory…')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /^View / })).not.toBeInTheDocument();
  },
};

export const LoadFailed: InventoryStory = {
  name: 'Catalog failed to load',
  beforeEach: prepare({
    items: [],
    inventoryStatus: 'error',
    inventoryError: 'Unable to load inventory right now.',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Unable to load inventory right now.')).toBeVisible();
    await expect((await canvas.findAllByText('No items yet')).length).toBeGreaterThan(0);
  },
};

export const Dispensary: InventoryStory = {
  name: 'Switching to the Dispensary queue',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: /^Inventory/ });

    await userEvent.click(canvas.getByRole('button', { name: 'Dispensary' }));

    await expect(
      await canvas.findByRole('heading', { level: 1, name: /^Dispensary/ })
    ).toBeVisible();

    // A pending request names the pet and, by its last name, the pet parent.
    // Rendered once for the table layout and once for the card layout.
    await expect((await canvas.findAllByText('Biscuit • Okafor')).length).toBeGreaterThan(0);
    await expect(
      canvas.getByRole('button', { name: 'Dispense prescription for Biscuit' })
    ).toBeEnabled();

    // Already dispensed: no Dispense action left to take.
    await expect(canvas.getAllByText('Whiskers • Chen').length).toBeGreaterThan(0);
    await expect(
      canvas.queryByRole('button', { name: 'Dispense prescription for Whiskers' })
    ).not.toBeInTheDocument();
  },
};

export const Phone: InventoryStory = {
  name: 'Phone: bespoke card catalog below the table',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The phone catalog's own low-stock filter pill only exists below the breakpoint.
    await expect(await canvas.findByRole('button', { name: 'Low (1)' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'View Amoxicillin 250mg' })).toBeVisible();
    // "New product" moves to the phone shell's FAB, which this page does not render.
    await expect(canvas.queryByRole('button', { name: 'New product' })).not.toBeInTheDocument();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
