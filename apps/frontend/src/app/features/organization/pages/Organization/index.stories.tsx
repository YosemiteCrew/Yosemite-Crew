import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type {
  Organisation,
  OrganisationRoom,
  Speciality,
  UserOrganization,
} from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type { BillingSubscription } from '@/app/features/billing/types/billing';
import type { OrganizationDocument } from '@/app/features/documents/types/document';
import type { SpecialityRevamp } from '@/app/features/organization/types/revamp';
import type { Team } from '@/app/features/organization/types/team';
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
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import { PERMISSIONS } from '@/app/lib/permissions';
import Organization from './index';

const ORG_ID = 'org-storybook-organization';

const ORG_VERIFIED: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/**
 * `computeOrgOnboardingStep` reads the full address, not just `isVerified`:
 * below step 2 the unverified-owner branch of `OrgGuard` forces a redirect to
 * `/create-org` before this page is ever reached. The verified fixture above
 * gets away without one because that check only runs on the unverified path.
 */
const ORG_UNVERIFIED: Organisation = {
  ...ORG_VERIFIED,
  isVerified: false,
  address: {
    addressLine: '14 Harbour Row',
    city: 'Bristol',
    state: 'Bristol',
    postalCode: 'BS1 4RN',
    country: 'United Kingdom',
  },
};

const membership = (revoked: string[] = []): UserOrganization => ({
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const TEAM_MEMBERS: Team[] = [
  {
    _id: 'team-marsh',
    practionerId: 'vet-marsh',
    organisationId: ORG_ID,
    name: 'Dr. Elena Marsh',
    role: 'VETERINARIAN',
    speciality: [],
    status: 'Available',
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
  {
    _id: 'team-reyes',
    practionerId: 'tech-reyes',
    organisationId: ORG_ID,
    name: 'Tom Reyes',
    role: 'TECHNICIAN',
    speciality: [],
    status: 'Off-Duty',
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
];

const ROOMS: OrganisationRoom[] = [
  {
    id: 'room-surgery-1',
    name: 'Surgery 1',
    organisationId: ORG_ID,
    code: 'SURG-1',
    type: 'SURGERY',
    capabilities: ['Orthopaedic'],
  },
  {
    id: 'room-exam-a',
    name: 'Exam room A',
    organisationId: ORG_ID,
    code: 'EXAM-A',
    type: 'EXAM_ROOM',
  },
];

const DOCUMENTS: OrganizationDocument[] = [
  {
    _id: 'doc-consent',
    organisationId: ORG_ID,
    title: 'Surgical consent form',
    description: 'Signed before any procedure requiring anaesthesia.',
    fileUrl: '',
    category: 'GENERAL',
  },
  {
    _id: 'doc-privacy',
    organisationId: ORG_ID,
    title: 'Privacy policy',
    fileUrl: 'https://example.com/privacy.pdf',
    category: 'PRIVACY_POLICY',
  },
];

const SPECIALITIES: SpecialityRevamp[] = [
  {
    id: 'spec-dentistry',
    name: 'Dentistry',
    organisationId: ORG_ID,
    headVetId: 'vet-marsh',
    teamMemberIds: ['tech-reyes'],
    activeServiceCount: 4,
    activePackageCount: 1,
  },
];

/**
 * A second, older representation of the same speciality. `Specialities.tsx`
 * itself renders from `useRevampCatalogStore` (`SPECIALITIES` above), but the
 * phone screen's accordion (`PhoneOrganization`) and the desktop drawer's
 * initial selection both come from `useSpecialitiesWithServiceNamesForPrimaryOrg`,
 * which reads the older `useSpecialityStore` instead - so both stores need an
 * entry for the name to appear in every place it can show up on this page.
 */
const SPECIALITIES_LEGACY: Speciality[] = [
  {
    _id: 'spec-dentistry',
    organisationId: ORG_ID,
    name: 'Dentistry',
    headUserId: 'vet-marsh',
    teamMemberIds: ['tech-reyes'],
  },
];

const SUBSCRIPTION: BillingSubscription = {
  orgId: ORG_ID,
  currency: 'GBP',
  canAcceptPayments: true,
  connectChargesEnabled: true,
  connectPayoutsEnabled: true,
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
 * The page itself makes no request of its own - every section reads a Zustand
 * store - but `BookingRequests` calls `bookingRequestsApi.list` on mount
 * regardless of what `OrgGuard` has already loaded, and it expects the nested
 * `{ data: { data: [...] } }` shape `getData` unwraps, not the bare array the
 * generic fallback below returns. Answering it explicitly is what keeps the
 * section from setting its list state to `undefined` and crashing on the next
 * render's `.filter`. The two finance calls OrgGuard's subscription loader
 * makes are answered the same defensive way Discounts/Estimates/Finance do.
 */
const buildAdapter = (): AxiosAdapter => (config: InternalAxiosRequestConfig) => {
  const url = String(config.url ?? '');
  if (url.includes('/booking-page/')) {
    return Promise.resolve(respond(config, { data: [] }));
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

/**
 * The page ships behind `ProtectedRoute` and `OrgGuard`, and it renders eleven
 * dynamically-imported sections of its own once the org is verified - the
 * heaviest composition in the app. The stories satisfy the guards with real
 * data - an authenticated session, an org past onboarding, an active
 * membership, a profile past onboarding step 3 and one availability row -
 * rather than the dev-only bypass flag, which only works under the dev server:
 * a static build inlines every `process.env.NEXT_PUBLIC_*` read at build time,
 * so assigning one at runtime changes nothing and the guards redirect.
 *
 * Every org-scoped store OrgGuard's eleven loaders would otherwise reach for is
 * seeded so each short-circuits rather than hitting the network. Team, rooms,
 * documents and the specialities catalog are seeded for real: this page renders
 * them directly, not through a loading state.
 */
const prepare =
  ({
    org = ORG_VERIFIED,
    revoked = [],
    teams = TEAM_MEMBERS,
    rooms = ROOMS,
    documents = DOCUMENTS,
    specialities = SPECIALITIES,
    legacySpecialities = SPECIALITIES_LEGACY,
    subscription = SUBSCRIPTION,
  }: {
    org?: Organisation;
    revoked?: string[];
    teams?: Team[];
    rooms?: OrganisationRoom[];
    documents?: OrganizationDocument[];
    specialities?: SpecialityRevamp[];
    legacySpecialities?: Speciality[];
    subscription?: BillingSubscription;
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
      revampCatalog: useRevampCatalogStore.getState(),
      room: useOrganisationRoomStore.getState(),
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
      orgsById: { [ORG_ID]: org },
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    useTeamStore.getState().setTeamsForOrg(ORG_ID, teams);
    useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, legacySpecialities);
    useOrganisationRoomStore.getState().setRoomsForOrg(ORG_ID, rooms);
    useInvoiceStore.setState({ invoiceIdsByOrgId: emptyIndex, status: 'loaded' });
    useTaskStore.setState({ taskIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganizationDocumentStore.getState().setDocumentsForOrg(ORG_ID, documents);
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
    useSubscriptionStore.setState({ subscriptionByOrgId: { [ORG_ID]: subscription } });
    // `loadOrganisationCatalog` only skips the network once SOME seeded
    // speciality carries this org id, so an empty `specialities` fixture is
    // still answered - by the adapter's own empty-array fallback - rather than
    // left to redirect a real request out of the story.
    useRevampCatalogStore.setState({
      specialities,
      services: [],
      packages: [],
      loadedSpecialityIds: [],
      status: specialities.length ? 'ready' : 'idle',
    });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useTeamStore.setState(snapshots.team);
      useTaskStore.setState(snapshots.task);
      useSubscriptionStore.setState(snapshots.subscription);
      useSpecialityStore.setState(snapshots.speciality);
      useOrganisationRoomStore.setState(snapshots.room);
      useRevampCatalogStore.setState(snapshots.revampCatalog);
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
  title: 'Organization/Organization',
  component: Organization,
  parameters: {
    layout: 'fullscreen',
    // ProtectedRoute and OrgGuard both read usePathname; /organization is the
    // one route in `appRoutes` marked `verify: false`, which is what lets an
    // unverified org land on it instead of being bounced to /create-org.
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The organisation settings page: the clinic profile band, the specialities/services ' +
          'catalog and - once the organisation is verified - the team roster, rooms, payment ' +
          'status, documents, e-signing, linked medical devices, online booking setup and ' +
          'booking requests. Laid out as two columns on desktop and swapped below the phone ' +
          'breakpoint (`useIsPhone`) for a purpose-built scroll screen with the same data.\n\n' +
          'An unverified organisation sees a deliberately smaller page: specialities/services ' +
          'and the delete-organisation control, nothing else. That is not a loading state - it ' +
          'is the actual shape of the page while an organisation is still working through ' +
          'verification, which is why a story that always shows the full grid would hide a real ' +
          "branch of this component's own render logic rather than just a guard redirect.\n\n" +
          'Each section is independently gated behind its own `PermissionGate` - view rooms, view ' +
          'the team roster, view billing, view documents, view specialities - so a role missing ' +
          'one permission loses one card rather than the whole page. That composition is only ' +
          'visible with every section mounted together, which is what these stories are for: ' +
          'each section already has its own file covering its internal states in depth. The ' +
          'stories here lift `ProtectedRoute` and `OrgGuard` with real data rather than the ' +
          "dev-only bypass flag, and seed every org-scoped store the guard's eleven loaders would " +
          'otherwise reach for.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare(),
} satisfies Meta<typeof Organization>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  name: 'Verified organisation',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Organization' })
    ).toBeVisible();
    await expect(
      canvas.getByText('Clinic profile, team, rooms, specialities and the services you offer')
    ).toBeVisible();

    // The clinic profile band, always drawn first regardless of verification.
    await expect(canvas.getByText('Harbourside Veterinary Group')).toBeVisible();
    await expect(canvas.getByText('VERIFIED')).toBeVisible();

    // Verified-only sections: team, rooms and payment sit in the right/left
    // columns of the grid this branch renders.
    await expect(canvas.getByRole('heading', { name: 'Team (2)' })).toBeVisible();
    await expect(canvas.getByText('Dr. Elena Marsh')).toBeVisible();
    await expect(canvas.getByText('Tom Reyes')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Rooms (2)' })).toBeVisible();
    await expect(canvas.getByText('Surgery 1')).toBeVisible();
    await expect(canvas.getByText('Payments · Stripe')).toBeVisible();
    await expect(canvas.getByText('Charges and payouts enabled')).toBeVisible();

    // Specialities renders in both branches - here fed by the real catalog store.
    // `SpecialitiesTableRevamp` swaps a table for a card grid on a container
    // query keyed to ITS OWN width, not the viewport, so only the section
    // header is asserted here rather than which of the two layouts a
    // particular column width happens to select.
    await expect(canvas.getByText('Specialties, services & packages')).toBeVisible();

    // The rest of the verified-only content further down the page.
    await expect(canvas.getByRole('heading', { name: 'Linked medical devices' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(canvas.getByText('Surgical consent form')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'E-signing' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Online booking' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Booking requests' })).toBeVisible();
    await expect(
      await canvas.findByText(
        'No booking requests yet. Confirmed requests from your public booking page appear here.'
      )
    ).toBeVisible();

    // OWNER holds `org:delete`, so the danger band sits at the bottom of the page.
    await expect(canvas.getByRole('button', { name: 'Delete organization' })).toBeEnabled();
  },
};

export const Unverified: Story = {
  name: 'Unverified organisation',
  beforeEach: prepare({ org: ORG_UNVERIFIED }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Organization' })
    ).toBeVisible();
    await expect(canvas.getByText('PENDING')).toBeVisible();

    // The reduced branch: specialities and the delete control, nothing else.
    await expect(canvas.getByText('Specialties, services & packages')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Delete organization' })).toBeEnabled();

    // None of the verified-only sections mount at all - not hidden, absent.
    await expect(canvas.queryByRole('heading', { name: /^Team/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: /^Rooms/ })).not.toBeInTheDocument();
    await expect(canvas.queryByText('Payments · Stripe')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('heading', { name: 'Linked medical devices' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'Documents' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'E-signing' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'Online booking' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('heading', { name: 'Booking requests' })
    ).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'Verified organisation with nothing set up yet',
  beforeEach: prepare({
    teams: [],
    rooms: [],
    documents: [],
    specialities: [],
    legacySpecialities: [],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Team (0)' })).toBeVisible();
    await expect(canvas.getByText('No team members yet.')).toBeVisible();
    await expect(canvas.getByText('No rooms added yet.')).toBeVisible();
    await expect(
      canvas.getByText('No documents yet. Add clinic-wide templates and files.')
    ).toBeVisible();
    // The revamp catalog is genuinely empty here rather than mid-fetch: the
    // fixture seeds it empty and the adapter answers the mount-effect's own
    // load with an empty list too, so this is the resting empty state.
    // `SpecialitiesTableRevamp` renders BOTH its table and card layouts and
    // lets a container query hide one, so the empty message legitimately
    // exists twice in the DOM at once - `getAllByText` avoids the ambiguity
    // error a plain `getByText` would throw on either responsive layout.
    await expect(await canvas.findAllByText('No specialities yet')).toHaveLength(2);
  },
};

export const RestrictedByRole: Story = {
  name: 'Several sections restricted by role',
  beforeEach: prepare({
    revoked: [
      PERMISSIONS.SPECIALITIES_VIEW_ANY,
      PERMISSIONS.ROOM_VIEW_ANY,
      PERMISSIONS.TEAMS_VIEW_ANY,
      PERMISSIONS.DOCUMENT_VIEW_ANY,
      PERMISSIONS.SUBSCRIPTION_VIEW_ANY,
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Each gated section loses its content but keeps its place on the page -
    // this is the behaviour that is only visible with every section composed
    // together, since no individual section's own story can show five losing
    // their content on one screen at once.
    await expect(
      await canvas.findByText("Your role (Owner) can't view specialities, services and packages.")
    ).toBeVisible();
    await expect(canvas.getByText("Your role (Owner) can't view rooms.")).toBeVisible();
    await expect(canvas.getByText("Your role (Owner) can't view the team roster.")).toBeVisible();
    await expect(canvas.getByText("Your role (Owner) can't view documents.")).toBeVisible();
    await expect(
      canvas.getByText("Your role (Owner) can't view billing and subscription.")
    ).toBeVisible();

    // Sections with no PermissionGate of their own are unaffected.
    await expect(canvas.getByRole('heading', { name: 'Online booking' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Linked medical devices' })).toBeVisible();
    await expect(canvas.queryByText('Dr. Elena Marsh')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Surgery 1')).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Below the phone breakpoint the whole page swaps for `PhoneOrganization`,
    // a different component tree rather than a CSS reflow of the desktop one.
    await expect(await canvas.findByLabelText('Go back')).toBeVisible();
    await expect(canvas.getByText('Organization')).toBeVisible();
    await expect(canvas.getByText('Team · 2')).toBeVisible();
    await expect(canvas.getByText('Dr. Elena Marsh')).toBeVisible();
    await expect(canvas.getByText('Specialities & services')).toBeVisible();
    await expect(canvas.getByText('Dentistry · 0 services')).toBeVisible();
    await expect(canvas.getByText('Stripe payments connected')).toBeVisible();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
