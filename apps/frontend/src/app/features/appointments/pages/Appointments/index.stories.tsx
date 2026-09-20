import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Appointment, Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useSearchStore } from '@/app/stores/searchStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Appointments from './index';

const ORG_ID = 'org-storybook-appointments';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Blackthorn Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 161 496 0142',
  taxId: 'GB-4471-2093',
  isVerified: true,
};

const membership = (revoked: string[] = []): UserOrganization => ({
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-lindqvist',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

/**
 * Enough of a profile and one published availability day to clear
 * `computeTeamOnboardingStep`. Below step 3 `OrgGuard` redirects the whole route
 * to /team-onboarding, so an incomplete fixture does not render a worse story -
 * it renders no story at all.
 *
 * `pmsPreferences` is what keeps `/appointments` itself from being redirected:
 * `OrgGuard` sends an OWNER's first visit to `/dashboard` unless the profile's
 * preferred landing screen already IS Appointments, and separately restores the
 * saved `appointmentView` on mount - overriding whatever `resolveDefaultAppointmentsView`
 * read from local storage. `TABLE` is chosen here because it is the one view
 * that renders through the already-proven `Tables/Appointments` component.
 */
const PROFILE: UserProfile = {
  _id: 'profile-storybook',
  userId: 'user-storybook',
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1989-11-02',
    phoneNumber: '+44 161 496 0142',
    address: {
      addressLine: '9 Blackthorn Mews',
      city: 'Manchester',
      state: 'Greater Manchester',
      postalCode: 'M1 4BT',
      country: 'United Kingdom',
    },
    pmsPreferences: {
      defaultOpenScreen: 'APPOINTMENTS',
      appointmentView: 'TABLE',
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

/* Local Date constructors, not UTC literals: the list's date/time cells format
   through the org's preferred time zone, so a '...T09:30:00.000Z' fixture would
   render a different hour - and in some zones a different day - depending on
   where the story runs. */
const appointment = (
  id: string,
  companionName: string,
  overrides: Partial<Appointment> = {}
): Appointment => {
  const who = {
    id: `companion-${id}`,
    name: companionName,
    species: 'dog',
    breed: 'Beagle',
    parent: { id: `parent-${id}`, name: 'Priya Nakamura' },
  };
  return {
    id,
    patient: who,
    companion: who,
    lead: { id: 'pract-lead-1', name: 'Dr. Sasha Lindqvist' },
    appointmentType: {
      id: 'type-wellness',
      name: 'Wellness exam',
      speciality: { id: 'spec-general', name: 'General practice' },
    },
    organisationId: ORG_ID,
    appointmentDate: new Date(2026, 5, 15, 9, 30),
    startTime: new Date(2026, 5, 15, 9, 30),
    endTime: new Date(2026, 5, 15, 10, 0),
    timeSlot: '09:30 - 10:00',
    durationMinutes: 30,
    status: 'UPCOMING',
    concern: 'Annual check-up',
    ...overrides,
  };
};

const MARIGOLD = appointment('appt-marigold', 'Marigold');
const OTIS = appointment('appt-otis', 'Otis', {
  status: 'CHECKED_IN',
  startTime: new Date(2026, 5, 15, 11, 0),
  endTime: new Date(2026, 5, 15, 11, 30),
  timeSlot: '11:00 - 11:30',
  concern: 'Vomiting since yesterday',
});
/* No lead at all: a completed visit affords no edit actions regardless of permission. */
const COCO = appointment('appt-coco', 'Coco', {
  status: 'COMPLETED',
  lead: undefined,
  startTime: new Date(2026, 5, 15, 13, 0),
  endTime: new Date(2026, 5, 15, 13, 30),
  timeSlot: '13:00 - 13:30',
  concern: 'Post-op check',
});

const BASE_APPOINTMENTS: Appointment[] = [MARIGOLD, OTIS, COCO];

/* `hasEmergency` only lights up for a future, still-open booking, so this one
   is built from `Date.now()` rather than a fixed date that would age out. */
const emergencyAppointment = (): Appointment =>
  appointment('appt-zephyr', 'Zephyr', {
    isEmergency: true,
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 2.5 * 60 * 60 * 1000),
    appointmentDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
    concern: 'Hit by car',
  });

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * The page itself reads every appointment, companion, team and org fact out of
 * the pre-seeded stores below, so it never calls the shared axios instance
 * directly. What DOES still reach it: `OrgGuard`'s subscription-counter loader,
 * which fetches unconditionally on every mount, and the always-mounted "New
 * appointment" dialog and the per-appointment detail modals, whose own data
 * needs are out of scope for this page-level story. The adapter answers the
 * two known finance calls and falls back to an empty 200 for anything else, so
 * nothing from this tree ever reaches the real network.
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
 * The page ships behind `ProtectedRoute` and `OrgGuard`. The stories satisfy the guards with real
 * data - an authenticated session, a verified org, an active membership, a
 * profile past onboarding step 3 and one availability row - rather than with the
 * `NEXT_PUBLIC_DISABLE_AUTH_GUARD` bypass, which only works under the dev server:
 * a static build inlines every `process.env.NEXT_PUBLIC_*` read at build time, so
 * assigning one at runtime changes nothing and the guards redirect.
 *
 * Every org-scoped store OrgGuard's eleven loaders would otherwise fetch is
 * seeded with an entry for this org so each short-circuits on
 * `Object.hasOwn(...ByOrgId, primaryOrgId)` rather than reaching the network.
 * Companions and their parents are left empty on purpose: the page enriches an
 * appointment's companion from that store when a match exists but renders the
 * appointment's own embedded companion fields when it does not, and every
 * fixture below already carries a full companion record.
 */
const prepare =
  ({ appointments, revoked = [] }: { appointments: Appointment[]; revoked?: string[] }) =>
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
      appointmentsById: Object.fromEntries(appointments.map((a) => [a.id as string, a])),
      appointmentIdsByOrgId: { [ORG_ID]: appointments.map((a) => a.id as string) },
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: {},
      companionsIdsByOrgId: emptyIndex,
      companionIdsByParentId: {},
      status: 'loaded',
    });
    useParentStore.setState({ parentsById: {}, parentIds: [], status: 'loaded' });
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'GBP' } },
    });
    // The shared header writes here; a query left by another story would filter this list.
    useSearchStore.setState({ query: '' });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useTeamStore.setState(snapshots.team);
      useTaskStore.setState(snapshots.task);
      useSubscriptionStore.setState(snapshots.subscription);
      useSpecialityStore.setState(snapshots.speciality);
      useSearchStore.setState(snapshots.search);
      useOrganisationRoomStore.setState(snapshots.room);
      useParentStore.setState(snapshots.parent);
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
  title: 'Appointments/Appointments',
  component: Appointments,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname; the landing-screen check inside OrgGuard
    // also keys off this exact pathname.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The appointments page: a calendar/board/list toggle over one shared filtered list, ' +
          'two collapsible panels above it (Waitlist, Front desk), and the create/detail/reschedule/ ' +
          'status/room dialogs the list and calendar open into.\n\n' +
          'The three views are dynamically imported and preloaded together so switching is instant, ' +
          'and which one opens first is not a hardcoded default - it is read from the signed-in ' +
          "user's `pmsPreferences.appointmentView`, falling back to the board view when the " +
          'preference is unset. A companion in the list is never rendered from the raw appointment ' +
          'alone: photo, gender, date of birth and the parent name are merged in live from the ' +
          'companion store whenever that companion has since been edited there, so the row reflects ' +
          "the parent's current record rather than whatever was true when the booking was made.\n\n" +
          'The whole surface sits behind `appointments:view:any`, and every edit action - the row ' +
          'menu items, "New appointment", drag-to-reschedule - additionally requires ' +
          '`appointments:edit:any` or, for a booking led by the signed-in practitioner, ' +
          '`appointments:edit:own`. The stories satisfy `ProtectedRoute` and `OrgGuard` with real ' +
          'data rather than the dev-only auth-bypass flag, seed the org-scoped stores OrgGuard would ' +
          'otherwise load, and answer the two finance calls its subscription loader always makes.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare({ appointments: BASE_APPOINTMENTS }),
} satisfies Meta<typeof Appointments>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three appointments booked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The title carries a live count - "Appointments (3)" - so it is matched on
       its stem rather than in full. */
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /^Appointments/ })
    ).toBeVisible();
    await expect(canvas.getAllByRole('button', { name: /^Actions for / })).toHaveLength(3);
    await expect(canvas.getByRole('button', { name: 'New appointment' })).toBeEnabled();
  },
};

export const Empty: Story = {
  name: 'No appointments booked',
  beforeEach: prepare({ appointments: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /^Appointments/ })
    ).toBeVisible();
    // The table and the card list both render their own copy of the same empty state.
    await expect(canvas.getAllByText('No appointments yet')).toHaveLength(2);
    await expect(canvas.queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument();
  },
};

export const ViewDenied: Story = {
  name: 'View permission revoked',
  beforeEach: prepare({ appointments: BASE_APPOINTMENTS, revoked: ['appointments:view:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The role keeps appointments:view:own, so the route itself still opens -
    // it is this page's own gate, scoped to view:any, that denies the content.
    await expect(await canvas.findByText("You don't have access to Appointments")).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Edit permission revoked - no New appointment',
  beforeEach: prepare({
    appointments: BASE_APPOINTMENTS,
    revoked: ['appointments:edit:any', 'appointments:edit:own'],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The list is still there to read; the create action is absent rather than disabled.
    await expect(canvas.getAllByRole('button', { name: /^Actions for / })).toHaveLength(3);
    await expect(canvas.queryByRole('button', { name: 'New appointment' })).not.toBeInTheDocument();
  },
};

export const Emergency: Story = {
  name: 'An emergency booking present',
  beforeEach: prepare({ appointments: [...BASE_APPOINTMENTS, emergencyAppointment()] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('button', { name: /^Actions for / })).toHaveLength(4);
    // The row-level chip; the Emergencies filter pill also lights up from the
    // same `hasEmergency` flag, but the chip is what a reader actually sees.
    await expect(canvas.getByText('Emergency')).toBeVisible();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Below `xl` the table gives way to a per-companion card list.
    await expect(await canvas.findByLabelText('View appointment for Marigold')).toBeInTheDocument();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
