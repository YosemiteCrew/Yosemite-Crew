import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, Organisation, UserOrganization } from '@yosemite-crew/types';

import type { ApiDayAvailability } from '../../components/Availability/utils';
import type { BillingCounter, BillingSubscription } from '../../../billing/types/billing';
import type { UserProfile } from '../../../users/types/profile';
// Relative, not `@/`: the Storybook Vite build does not resolve the alias for
// runtime imports inside story files.
import { useAppointmentStore } from '../../../../stores/appointmentStore';
import { useAppointmentWorkspaceStore } from '../../../../stores/appointmentWorkspaceStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useAvailabilityStore } from '../../../../stores/availabilityStore';
import { useCompanionStore } from '../../../../stores/companionStore';
import { useCounterStore } from '../../../../stores/counterStore';
import { useOrganizationDocumentStore } from '../../../../stores/documentStore';
import { useFormsStore } from '../../../../stores/formsStore';
import { useIntegrationStore } from '../../../../stores/integrationStore';
import { useInventoryStore } from '../../../../stores/inventoryStore';
import { useInvoiceStore } from '../../../../stores/invoiceStore';
import { useOrgStore } from '../../../../stores/orgStore';
import { useParentStore } from '../../../../stores/parentStore';
import { useUserProfileStore } from '../../../../stores/profileStore';
import { useRevampCatalogStore } from '../../../../stores/revampCatalogStore';
import { useOrganisationRoomStore } from '../../../../stores/roomStore';
import { useRouteLoaderStore } from '../../../../stores/routeLoaderStore';
import { useSpecialityStore } from '../../../../stores/specialityStore';
import { useSubscriptionStore } from '../../../../stores/subscriptionStore';
import { useTaskStore } from '../../../../stores/taskStore';
import { useTeamStore } from '../../../../stores/teamStore';
import WorkspaceRoute from './WorkspaceRoute';

const ORG_ID = 'org-workspace-route-story';
const ELENA = 'practitioner-elena';
const APPOINTMENT_ID = 'appointment-workspace-route-story';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '+49 30 1234567',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

/**
 * `roleDisplay` is load-bearing: OrgGuard's owner branch keys off
 * `role.toLowerCase() === 'owner'`, and the permission check recomputes the
 * effective set from `roleCode` rather than from any stored snapshot.
 */
const MEMBERSHIP: UserOrganization = {
  id: 'membership-workspace-route-story',
  practitionerReference: `Practitioner/${ELENA}`,
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: [],
};

/**
 * Every field here is read by `computeTeamOnboardingStep`. Drop one and the
 * profile step falls below 3, at which point OrgGuard redirects the owner to
 * /team-onboarding and the route under test renders nothing at all.
 */
const PROFILE: UserProfile = {
  _id: 'profile-workspace-route-story',
  userId: ELENA,
  organizationId: ORG_ID,
  status: 'COMPLETED',
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1988-04-12',
    phoneNumber: '+49 30 7654321',
    address: {
      addressLine: '18 Kastanienallee',
      city: 'Berlin',
      state: 'Berlin',
      postalCode: '10435',
      country: 'Germany',
    },
    pmsPreferences: { defaultOpenScreen: 'APPOINTMENTS' },
  },
  professionalDetails: {
    qualification: 'DVM',
    yearsOfExperience: 11,
    specialization: 'Internal medicine',
  },
};

/** One published day is enough for the third onboarding step to count as done. */
const AVAILABILITY: ApiDayAvailability[] = [
  {
    _id: 'availability-monday',
    organisationId: ORG_ID,
    dayOfWeek: 'monday',
    slots: [{ startTime: '09:00', endTime: '17:00', isAvailable: true }],
  },
];

const SUBSCRIPTION: BillingSubscription = {
  orgId: ORG_ID,
  plan: 'free',
  accessState: 'free',
  subscriptionStatus: 'none',
};

const COUNTER: BillingCounter = { orgId: ORG_ID, freeUsersLimit: 10, usersBillableCount: 4 };

/**
 * Tomorrow at 09:30 LOCAL, not a fixed calendar date.
 *
 * The workspace derives `viewOnly` from `isPastLockWindow(startTime, …)`, so a
 * hard-coded 2026 date would quietly slide into the locked branch once the clock
 * passed it - the story would keep passing while rendering a different screen
 * from the one it documents. Local-time constructors rather than a UTC literal,
 * because the meta bar reads local hours off this date.
 */
const buildStartTime = () => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 30, 0, 0);
  return start;
};

const buildAppointment = (status: Appointment['status']): Appointment => {
  const start = buildStartTime();
  const patient: Appointment['patient'] = {
    id: 'companion-poppy',
    name: 'Poppy Hartmann',
    species: 'Dog',
    breed: 'Beagle',
    parent: { id: 'parent-lena', name: 'Lena Hartmann' },
  };
  return {
    id: APPOINTMENT_ID,
    organisationId: ORG_ID,
    patient,
    companion: patient,
    appointmentType: {
      id: 'svc-consult',
      name: 'Consultation',
      speciality: { id: 'spec-general', name: 'General practice' },
    },
    appointmentDate: start,
    startTime: start,
    endTime: new Date(start.getTime() + 30 * 60 * 1000),
    timeSlot: '09:30 AM',
    durationMinutes: 30,
    status,
    concern: 'Limping on the left hind leg since Tuesday.',
    lead: { id: ELENA, name: 'Dr. Elena Marsh' },
  };
};

/**
 * Every store the route, its two guards or the workspace touches, snapshotted as
 * a group so a seeded organisation cannot leak into the next story. Zustand
 * `setState` merges, so writing the whole previous state back restores both data
 * and actions.
 */
type SnapshotableStore = {
  getState: () => unknown;
  setState: (partial: never) => void;
};

const SEEDED_STORES: SnapshotableStore[] = [
  useAppointmentStore,
  useAppointmentWorkspaceStore,
  useAuthStore,
  useAvailabilityStore,
  useCompanionStore,
  useCounterStore,
  useFormsStore,
  useIntegrationStore,
  useInventoryStore,
  useInvoiceStore,
  useOrgStore,
  useOrganisationRoomStore,
  useOrganizationDocumentStore,
  useParentStore,
  useRevampCatalogStore,
  useRouteLoaderStore,
  useSpecialityStore,
  useSubscriptionStore,
  useTaskStore,
  useTeamStore,
  useUserProfileStore,
];

/**
 * Offline transport.
 *
 * Seeding the stores silences OrgGuard's loaders - each one bails on its first
 * line once its `…ByOrgId` map holds the org - but the subscription counter
 * fetches unconditionally, and the workspace hydrates itself from four services
 * on mount. Left alone those reach the wire and log through `logger.error`,
 * which the story verifier counts as a failure. Axios picks the XHR adapter in
 * the browser, so swapping `XMLHttpRequest` is the seam that needs no module
 * mocking.
 *
 * The body is `[]`, not `{}`: several of these services call `.map` straight off
 * the payload, and an object body throws there. An empty array reads as "no
 * rows" to the list callers and as "no fields" to the normalisers, which only
 * ever look properties up.
 */
class OfflineXhr {
  status = 200;
  statusText = 'OK';
  responseText = '[]';
  response = '[]';
  responseURL = '';
  readyState = 4;
  timeout = 0;
  withCredentials = false;
  responseType = '';
  onloadend: (() => void) | null = null;
  open = () => undefined;
  setRequestHeader = () => undefined;
  getAllResponseHeaders = () => 'content-type: application/json\r\n';
  abort = () => undefined;
  send = () => {
    setTimeout(() => this.onloadend?.(), 0);
  };
}

type Seed = {
  /**
   * The appointment the org owns, if any. `null` seeds the org with an empty
   * appointment list - which is not the same as "not loaded yet", and is what
   * drives the not-found screen.
   */
  appointment?: Appointment | null;
  /** 'loading' is what holds the route on its own workspace loader. */
  appointmentStatus?: 'loading' | 'loaded';
};

const seedRoute = ({ appointment = null, appointmentStatus = 'loaded' }: Seed) => {
  const originalXhr = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = OfflineXhr as unknown as typeof XMLHttpRequest;

  const snapshots = SEEDED_STORES.map((store) => [store, store.getState()] as const);

  useAuthStore.setState({
    status: 'authenticated',
    attributes: { sub: ELENA, given_name: 'Elena', family_name: 'Marsh' },
  });

  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
    status: 'loaded',
  });

  useUserProfileStore.setState({ profilesByOrgId: { [ORG_ID]: PROFILE }, status: 'loaded' });
  useAvailabilityStore.getState().setAvailabilitiesForOrg(ORG_ID, AVAILABILITY);
  useTeamStore.getState().setTeamsForOrg(ORG_ID, []);
  useSubscriptionStore.getState().setSubscriptionForOrg(ORG_ID, SUBSCRIPTION);
  useCounterStore.getState().setCounterForOrg(ORG_ID, COUNTER);

  /* Order matters: `setAppointmentsForOrg` flips the store status to 'loaded',
     so the loading story has to overwrite it afterwards. Seeding the ORG KEY
     with an empty list is also what keeps `useLoadAppointmentsForPrimaryOrg`
     off the network - the loader tests for the key, not for rows. */
  useAppointmentStore.getState().setAppointmentsForOrg(ORG_ID, appointment ? [appointment] : []);
  if (appointmentStatus === 'loading') {
    useAppointmentStore.setState({ appointmentIdsByOrgId: {}, status: 'loading' });
  }

  /* An empty list still counts as "loaded for this org" to the remaining
     OrgGuard loaders. */
  useOrganisationRoomStore.setState({ roomIdsByOrgId: { [ORG_ID]: [] } });
  useCompanionStore.setState({ companionsIdsByOrgId: { [ORG_ID]: [] } });
  useOrganizationDocumentStore.setState({ documentIdsByOrgId: { [ORG_ID]: [] } });
  useInvoiceStore.setState({ invoiceIdsByOrgId: { [ORG_ID]: [] } });
  useIntegrationStore.setState({ integrationIdsByOrgId: { [ORG_ID]: [] } });
  useSpecialityStore.setState({ specialityIdsByOrgId: { [ORG_ID]: [] } });
  useFormsStore.setState({ lastFetchedByOrgId: { [ORG_ID]: '2026-08-19T00:00:00.000Z' } });
  useInventoryStore.setState({
    itemIdsByOrgId: { [ORG_ID]: [] },
    statusByOrgId: { [ORG_ID]: 'loaded' },
    lastFetchedByOrgId: { [ORG_ID]: '2026-08-19T00:00:00.000Z' },
  });

  return () => {
    globalThis.XMLHttpRequest = originalXhr;
    for (const [store, state] of snapshots) {
      store.setState(state as never);
    }
  };
};

const withRoute =
  (seed: Seed = {}) =>
  () =>
    seedRoute(seed);

/**
 * Both dead-end screens carry the same escape hatch, and it has two halves: the
 * route loader has to start BEFORE the push, or the app shows a blank frame
 * while /appointments boots. Testing only the push would pass with the loader
 * call deleted.
 */
const expectBackToAppointmentsWiring = async (canvas: ReturnType<typeof within>) => {
  await expect(useRouteLoaderStore.getState().isLoading).toBe(false);
  await userEvent.click(canvas.getByRole('button', { name: 'Back to appointments' }));
  await expect(getRouter().push).toHaveBeenCalledWith('/appointments');
  await expect(useRouteLoaderStore.getState().isLoading).toBe(true);
};

const meta = {
  title: 'Workspace/WorkspaceRoute',
  component: WorkspaceRoute,
  parameters: {
    layout: 'fullscreen',
    // ProtectedRoute and OrgGuard both read usePathname, and the route's own
    // back buttons push with useRouter.
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/appointments/${APPOINTMENT_ID}/workspace` },
    },
    docs: {
      description: {
        component:
          'The client entry for `/appointments/[id]/workspace`. It is not a thin redirect guard: ' +
          'behind ProtectedRoute and OrgGuard it renders three screens of its own before the ' +
          'workspace is ever reached - a loader while the org appointments are still arriving, a ' +
          'blocked-status message for an appointment that may not be opened clinically, and a ' +
          'not-found message once the store has settled with no match. The last two share a "Back ' +
          'to appointments" escape hatch. Every story seeds the auth, org and appointment stores ' +
          'the way bootstrap does and swaps the XHR transport, because the export is the GUARDED ' +
          'route and its inner content component is not exported.',
      },
    },
  },
  tags: ['autodocs'],
  args: { appointmentId: APPOINTMENT_ID },
  beforeEach: withRoute({ appointment: buildAppointment('UPCOMING') }),
} satisfies Meta<typeof WorkspaceRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Appointments still loading',
  beforeEach: withRoute({ appointmentStatus: 'loading' }),
  parameters: {
    docs: {
      description: {
        story:
          'While the org appointment list is in flight the route shows its own centred loader rather ' +
          'than the not-found message. `idle` renders the same thing, which is the point: a store ' +
          'that has never been asked must not read as "this appointment does not exist".',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const loader = await waitFor(() => {
      const element = canvasElement.querySelector('[data-testid="workspace-loader"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });

    // The loader is an `<output aria-live="polite">`, so a screen reader is told
    // the page is working rather than left on silence.
    await expect(loader.getAttribute('aria-live')).toBe('polite');
    await expect(loader).toHaveAccessibleName('Loading');

    // The distinction this story exists for.
    await expect(within(canvasElement).queryByText('Appointment not found.')).toBeNull();
  },
};

export const Enterable: Story = {
  name: 'Appointment found and enterable',
  beforeEach: withRoute({ appointment: buildAppointment('UPCOMING') }),
  parameters: {
    docs: {
      description: {
        story:
          'The pass-through case: an Upcoming appointment resolves out of the store and the route ' +
          'hands it to AppointmentWorkspace unchanged. The workspace hydrates from four services on ' +
          'mount, which the offline transport answers with empty payloads, so what renders here is ' +
          'the shell - header, stepper and meta bar - with no clinical record behind it.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The step bodies arrive as separate `next/dynamic` chunks, so the FIRST
       story in a run waits on the network while later ones read from cache.
       One second is not enough for that first fetch. */
    const active = await waitFor(
      () => {
        const buttons = canvasElement.querySelectorAll('[aria-current="step"]');
        expect(buttons).toHaveLength(1);
        return buttons[0] as HTMLElement;
      },
      { timeout: 10_000 }
    );

    /* An appointment that has not started yet must land on SOAP - never on
       Summary or discharge - regardless of any progress derived from the
       encounter. Nothing else in the UI reports which step was chosen, so a
       regression here is invisible without this assertion. */
    await expect(active).toHaveAccessibleName('SOAP Notes');

    // None of the route's own dead ends may be on screen at the same time.
    await expect(canvas.queryByText('Appointment not found.')).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Back to appointments' })).toBeNull();
  },
};

export const BlockedStatus: Story = {
  name: 'Blocked by status',
  beforeEach: withRoute({ appointment: buildAppointment('CANCELLED') }),
  parameters: {
    docs: {
      description: {
        story:
          'Requested, cancelled and no-show appointments never enter the clinical workspace. The ' +
          'message names the status it is refusing rather than saying "not allowed", so the reader ' +
          'knows whether to reinstate the booking or open a different one.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The exact sentence, not a substring: `getWorkspaceBlockedMessage` builds
       it from the status label, so a label change ("Cancelled" -> "Canceled")
       or a fallback to the generic "This appointment cannot be opened in the
       workspace." would otherwise pass unnoticed. */
    await canvas.findByText('Cancelled appointments cannot be opened in the clinical workspace.');

    await expectBackToAppointmentsWiring(canvas);
  },
};

export const NotFound: Story = {
  name: 'Appointment not found',
  beforeEach: withRoute({ appointment: null }),
  parameters: {
    docs: {
      description: {
        story:
          'The store has settled and the org owns no appointment with this id - a stale link, or one ' +
          'belonging to another organisation. The route says so and offers the way back rather than ' +
          'redirecting on its own, so the reader can see that the URL was the problem.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText('Appointment not found.');
    await expectBackToAppointmentsWiring(canvas);
  },
};
