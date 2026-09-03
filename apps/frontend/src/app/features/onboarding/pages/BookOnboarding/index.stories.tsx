import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, within } from 'storybook/test';
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
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import BookOnboarding from './index';

const ORG_ID = 'org-storybook-book-onboarding';

const EMBED_URL =
  'https://app.cal.com/yosemitecrew/onboarding/embed?theme=light&layout=month_view&embedType=inline&embed=30min';

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

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/** The page itself makes no request; OrgGuard's subscription loader does, and is answered. */
const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
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
 *  its eleven
 * org-scoped loaders, and each store is seeded with an entry for this org so
 * they short-circuit rather than reaching the network.
 */
const prepare = () => {
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
    task: useTaskStore.getState(),
    team: useTeamStore.getState(),
  };
  api.defaults.adapter = adapter;

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
  useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });

  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    useTeamStore.setState(snapshots.team);
    useTaskStore.setState(snapshots.task);
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

const meta = {
  title: 'Onboarding/BookOnboarding',
  component: BookOnboarding,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname, and Back is `router.back()`.
    nextjs: { appDirectory: true, navigation: { pathname: '/book-onboarding' } },
    docs: {
      description: {
        component:
          'The onboarding-call page at `/book-onboarding`: a Back pill over a full-height ' +
          'Cal.com booking frame for the `yosemitecrew/onboarding` event.\n\n' +
          'It is one of the few private routes an unverified owner may open - `OrgGuard` ' +
          'allows it explicitly so a practice can book its onboarding call before the ' +
          'organisation is verified. Back is `router.back()`, not a link to a fixed page, so ' +
          'it returns the reader to whichever screen offered the call.\n\n' +
          'The frame is a live third-party embed. The stories render the container and assert ' +
          'the exact Cal link it is configured with through `data-cal-embed-src`; they do not ' +
          'wait for the third-party script, so the calendar area is expected to be empty ' +
          'offline. The route guards are lifted with the local-only bypass flag the shell ' +
          'honours, and the org-scoped stores OrgGuard would load are seeded.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare,
} satisfies Meta<typeof BookOnboarding>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Booking frame',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const back = await canvas.findByRole('button', { name: 'Go back' });
    await expect(back).toHaveTextContent('Back');

    // The frame advertises the exact Cal link it will mount.
    const frame = canvas.getByLabelText('Book onboarding call');
    await expect(frame).toHaveAttribute('data-cal-embed-src', EMBED_URL);
    await expect(frame).toHaveAttribute('data-cal-embed-frame', 'true');
    // Full height less the chrome above it, so the calendar gets the screen.
    await expect(frame.getBoundingClientRect().height).toBeGreaterThan(300);
  },
};

export const BackNavigates: Story = {
  name: 'Back returns to the previous screen',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Go back' }));
    // History, not a fixed route: whichever screen offered the call gets the reader back.
    await expect(getRouter().back).toHaveBeenCalledTimes(1);
    await expect(getRouter().push).not.toHaveBeenCalled();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Go back' })).toBeVisible();
    await expect(canvas.getByLabelText('Book onboarding call')).toBeInTheDocument();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
