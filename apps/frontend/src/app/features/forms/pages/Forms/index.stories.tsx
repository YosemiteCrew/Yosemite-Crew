import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type { FormsProps } from '@/app/features/forms/types/forms';
import type {
  PackageRevamp,
  ServiceRevamp,
  SpecialityRevamp,
} from '@/app/features/organization/types/revamp';
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
import { useSearchStore } from '@/app/stores/searchStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Forms from './index';

const ORG_ID = 'org-storybook-forms';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/**
 * Every shipped role carries `forms:edit:any`, so the read-only story is only
 * reachable through `revokedPermissions` - which is also how a practice really
 * takes template-editing rights off one person.
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

const SPECIALITY_ID = 'spec-dentistry';

const SPECIALITY: SpecialityRevamp = {
  id: SPECIALITY_ID,
  name: 'Dentistry',
  organisationId: ORG_ID,
  teamMemberIds: [],
};

const SERVICE: ServiceRevamp = {
  id: 'svc-dental-scale',
  code: 'CS-0001',
  name: 'Dental scale and polish',
  description: 'Full ultrasonic scale and polish under sedation.',
  type: 'PROCEDURE',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  grossAmount: 120,
  defaultDiscount: 0,
  maxDiscount: 10,
  durationMinutes: 45,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ACTIVE',
  createdAt: '2026-06-01T09:00:00.000Z',
};

const PACKAGE: PackageRevamp = {
  id: 'pkg-senior-wellness',
  code: 'PK-0001',
  name: 'Senior wellness package',
  description: 'Bloods, exam and dental check bundled for senior companions.',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  durationText: '60 min',
  isBookable: true,
  isInpatientPreferred: false,
  leadCount: 1,
  supportCount: 1,
  additionalDiscount: 0,
  breakdown: [],
  status: 'ACTIVE',
  createdAt: '2026-06-01T09:00:00.000Z',
};

const form = (
  id: string,
  name: string,
  category: FormsProps['category'],
  status: FormsProps['status'],
  over: Partial<FormsProps> = {}
): FormsProps => ({
  _id: id,
  orgId: ORG_ID,
  name,
  category,
  usage: 'Internal & External',
  requiredSigner: 'CLIENT',
  updatedBy: 'vet-weber',
  lastUpdated: '02 Sep',
  status,
  schema: [{ id: 'f1', type: 'input', label: 'Field one' }],
  ...over,
});

const FORMS: FormsProps[] = [
  form('form-consent', 'Anaesthesia consent', 'Consent form', 'Published', {
    description: 'Signed before any procedure requiring general anaesthetic.',
    services: ['svc-dental-scale'],
  }),
  form('form-soap', 'SOAP note', 'SOAP', 'Draft', {
    description: 'Standard subjective/objective/assessment/plan note.',
  }),
  form('form-discharge', 'Discharge summary', 'Discharge Form', 'Archived'),
];

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
 * Nothing this page renders reaches the network on purpose: the forms list, the
 * catalog (specialities/services/packages) and every org-scoped index OrgGuard
 * loads are all seeded directly into their stores below, so each loader's own
 * "already have this org" short-circuit fires before a request is built. This
 * adapter exists as the safety net for whatever still asks - it answers every
 * request with an empty, harmless body instead of letting it hang or reach a
 * real server.
 */
const buildAdapter = (): AxiosAdapter => (config: InternalAxiosRequestConfig) =>
  Promise.resolve(respond(config, []));

const REAL_ADAPTER = api.defaults.adapter;

/**
 * The page ships behind `ProtectedRoute` and `OrgGuard`. The stories satisfy the guards with real
 * data - an authenticated session, a verified org, an active membership, a
 * profile past onboarding step 3 and one availability row - rather than with the
 * `NEXT_PUBLIC_DISABLE_AUTH_GUARD` bypass, which only works under the dev server:
 * a static build inlines every `process.env.NEXT_PUBLIC_*` read at build time, so
 * assigning one at runtime changes nothing and the guards redirect.
 *
 * OrgGuard's own loaders touch eleven org-scoped stores; each is seeded with an
 * entry for this org so it short-circuits on `Object.hasOwn(...ByOrgId, primaryOrgId)`
 * rather than reaching the network. The forms store and the revamp catalog store are
 * seeded with real rows, since the page reads both directly - the catalog's
 * `loadedSpecialityIds` entry is what stops `loadSpecialityCatalog` from firing too.
 */
const prepare =
  ({
    forms = FORMS,
    formsLoading = false,
    revoked = [],
  }: {
    forms?: FormsProps[];
    formsLoading?: boolean;
    revoked?: string[];
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
      catalog: useRevampCatalogStore.getState(),
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
    useFormsStore.setState({
      formsById: Object.fromEntries(forms.map((f) => [f._id as string, f])),
      formIds: forms.map((f) => f._id as string),
      activeFormId: forms[0]?._id ?? null,
      loading: formsLoading,
      lastFetchedByOrgId: fetchedAt,
    });
    useRevampCatalogStore.setState({
      specialities: [SPECIALITY],
      services: [SERVICE],
      packages: [PACKAGE],
      status: 'ready',
      loadedSpecialityIds: [`${SPECIALITY_ID}:active`],
    });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'GBP' } },
    });
    // The shared header search bar writes here; a query left by another story
    // would filter this page's list too.
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
      useRevampCatalogStore.setState(snapshots.catalog);
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
  title: 'Forms/Forms',
  component: Forms,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname.
    nextjs: { appDirectory: true, navigation: { pathname: '/forms' } },
    docs: {
      description: {
        component:
          'The Templates page: a status/category filter row over a table of the ' +
          "organisation's form templates, each row opening the builder or the read-only " +
          'info panel behind its ellipsis menu.\n\n' +
          "A row's linked-service chips are resolved from the revamp catalog store, not " +
          'printed from the raw `services` ids on the form - a service that has since been ' +
          'deleted or belongs to another organisation renders as "Unavailable service" ' +
          'rather than a bare ObjectID. The list itself combines two sources - legacy ' +
          'Questionnaire-backed forms and the newer template-backed rows - merged by id so a ' +
          'form migrated between the two never appears twice.\n\n' +
          'The page sits behind `forms:view:any`, and "Add" behind `forms:edit:any`, both ' +
          'derived from the seeded role. The stories satisfy `ProtectedRoute` and `OrgGuard` ' +
          'with real data - an authenticated session, a verified org, an active membership, a ' +
          'profile past onboarding step 3 and one availability row - and seed the forms store ' +
          'and the revamp catalog store directly, so no loader in this tree reaches the network.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare({}),
} satisfies Meta<typeof Forms>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * `FormsTable` renders a desktop table AND a phone card list at once - Tailwind
 * `hidden xl:flex` / `flex xl:hidden` toggles which one is visible, but both sit
 * in the DOM together, each printing the same form name. An unscoped query for
 * "Anaesthesia consent" therefore matches twice regardless of viewport; these
 * helpers scope to whichever branch the story's viewport actually shows.
 */
const desktopTable = (canvasElement: HTMLElement) =>
  within(canvasElement.querySelector('.table-list') as HTMLElement);
const phoneCards = (canvasElement: HTMLElement) =>
  within(canvasElement.querySelector('.card-list') as HTMLElement);

export const TemplatesLoaded: Story = {
  name: 'Three templates',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByRole('heading', { level: 1, name: /^Templates/ })).toBeVisible();
    const table = desktopTable(canvasElement);
    await expect(table.getByText('Anaesthesia consent')).toBeVisible();
    await expect(table.getByText('SOAP note')).toBeVisible();
    await expect(table.getByText('Discharge summary')).toBeVisible();
    // Linked service resolved from the catalog store, not printed as a raw id.
    await expect(table.getByText('Dental scale and polish')).toBeVisible();
    await expect(canvasElement.textContent).not.toContain('svc-dental-scale');
    await expect(canvas.getByRole('button', { name: 'Add' })).toBeEnabled();
  },
};

export const NoTemplates: Story = {
  name: 'No templates yet',
  beforeEach: prepare({ forms: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByRole('heading', { level: 1, name: /^Templates/ })).toBeVisible();
    const table = desktopTable(canvasElement);
    await expect(table.getByText('No templates yet')).toBeVisible();
    await expect(
      table.getByText('Templates you build appear here, ready to link to a service.')
    ).toBeVisible();
  },
};

export const LoadingTemplates: Story = {
  name: 'Loading templates',
  beforeEach: prepare({ formsLoading: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByRole('heading', { level: 1, name: /^Templates/ })).toBeVisible();
    const table = desktopTable(canvasElement);
    await expect(table.getByText('Loading forms…')).toBeVisible();
    await expect(canvas.queryByText('Anaesthesia consent')).not.toBeInTheDocument();
  },
};

export const StatusFilterApplied: Story = {
  name: 'Filtering by status',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: /^Templates/ });
    const table = desktopTable(canvasElement);
    await table.findByText('Anaesthesia consent');

    await userEvent.click(canvas.getByRole('button', { name: 'Draft' }));

    await waitFor(() => expect(table.getByText('SOAP note')).toBeVisible());
    await expect(table.queryByText('Anaesthesia consent')).not.toBeInTheDocument();
    await expect(table.queryByText('Discharge summary')).not.toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Template editing revoked - no Add',
  beforeEach: prepare({ revoked: ['forms:edit:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: /^Templates/ });
    const table = desktopTable(canvasElement);
    await expect(table.findByText('Anaesthesia consent')).toBeVisible();
    // The list is still there to read; the action is absent rather than disabled.
    await expect(canvas.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: /^Templates/ });
    const cards = phoneCards(canvasElement);
    await expect(cards.findByText('Anaesthesia consent')).toBeVisible();
    await expect(canvas.getByPlaceholderText('Search templates')).toBeVisible();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
