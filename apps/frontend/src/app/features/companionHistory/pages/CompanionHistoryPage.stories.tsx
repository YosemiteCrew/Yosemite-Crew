import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type {
  Appointment,
  Organisation,
  PetPassportDTO,
  UserOrganization,
} from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { PERMISSIONS } from '@/app/lib/permissions';
import { formatDisplayDate } from '@/app/lib/date';
import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import type { HistoryEntry } from '@/app/features/companionHistory/types/history';
import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';

import CompanionHistoryPage from './CompanionHistoryPage';

const ORG_ID = 'org-companion-overview-story';
const COMPANION_ID = 'companion-poppy';
const PARENT_ID = 'parent-lena';

const buildOrg = (type: Organisation['type']): Organisation => ({
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type,
  phoneNo: '+49 30 555 0134',
  taxId: 'DE-8871-2290',
  isVerified: true,
});

const FULL_ACCESS = [
  PERMISSIONS.COMPANIONS_VIEW_ANY,
  PERMISSIONS.COMPANIONS_EDIT_ANY,
  PERMISSIONS.APPOINTMENTS_EDIT_ANY,
];

/**
 * `roleCode` is deliberately empty. `resolveMembershipPermissions` returns the
 * extras verbatim when a membership carries no role, so a story's permission set
 * is exactly the array it names rather than a role baseline it has to reason
 * about. `roleDisplay` still has to be something other than "owner": the owner
 * branch of OrgGuard adds a verification check this page has no business in.
 */
const membership = (permissions: string[]): UserOrganization => ({
  practitionerReference: 'Practitioner/user-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: '',
  roleDisplay: 'Front desk',
  active: true,
  extraPermissions: permissions,
  revokedPermissions: [],
});

/**
 * Enough of a profile to clear `computeTeamOnboardingStep`. Below step 3 OrgGuard
 * redirects the whole route to /team-onboarding, so an incomplete fixture does
 * not render a worse story, it renders no story at all.
 */
const PROFILE: UserProfile = {
  _id: 'profile-1',
  userId: 'user-1',
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1989-11-02',
    phoneNumber: '+49 30 901820',
    address: {
      addressLine: 'Wallstrasse 14',
      city: 'Berlin',
      state: 'Berlin',
      postalCode: '10179',
      country: 'Germany',
    },
  },
  professionalDetails: {
    qualification: 'DVM',
    yearsOfExperience: 8,
    specialization: 'Internal medicine',
  },
  status: 'COMPLETED',
};

/** One published day is all the third onboarding step needs. */
const AVAILABILITY: ApiDayAvailability = {
  _id: 'availability-monday',
  userId: 'user-1',
  organisationId: ORG_ID,
  dayOfWeek: 'MONDAY',
  slots: [
    { startTime: '09:00', endTime: '17:00', isAvailable: true },
  ] as ApiDayAvailability['slots'],
};

/**
 * Ages are computed against the clock, so every date fixture here is built
 * RELATIVE to now. A literal date of birth would print "4 years" today and
 * "5 years" after the next birthday, and the story would start failing on a
 * calendar date rather than on a code change.
 *
 * The day-of-month is forced to the 1st before the year is rolled back, which
 * makes the month arithmetic in `getAgeInMonths` exact: today's day-of-month is
 * never below 1, so the "birthday has not come round yet" decrement can never
 * fire, and a 29 February fixture can never land on a non-leap year.
 */
const yearsAgoOnTheFirst = (years: number): Date => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(date.getFullYear() - years);
  return date;
};

const COMPANION_DOB = yearsAgoOnTheFirst(4);
const PARENT_DOB = yearsAgoOnTheFirst(37);

/** Local date parts, never a `...Z` literal: last visit is compared in local time. */
const daysFromNow = (offset: number, hour: number, minute: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute);
};

const PAST_VISIT = daysFromNow(-10, 9, 0);
const FUTURE_VISIT = daysFromNow(5, 14, 30);

type CompanionWithLinks = StoredCompanion & {
  parentLinks?: Array<{
    role?: string;
    status?: string;
    parent?: { firstName?: string; lastName?: string };
  }>;
};

const FULL_COMPANION: CompanionWithLinks = {
  id: COMPANION_ID,
  organisationId: ORG_ID,
  parentId: PARENT_ID,
  name: 'Poppy Hartmann',
  type: 'dog',
  breed: 'Beagle',
  dateOfBirth: COMPANION_DOB,
  gender: 'female',
  isneutered: true,
  currentWeight: 11.4,
  colour: 'Tricolour',
  bloodGroup: 'DEA 1.1 negative',
  microchipNumber: '981020034512789',
  allergy: 'Cephalosporins; poultry protein',
  passportNumber: 'GB-2026-004471',
  isInsured: true,
  insurance: { isInsured: true, companyName: 'PetSecure', policyNumber: 'PS-99120' },
  status: 'active',
  alerts: [
    { title: 'Needs muzzle', severity: 'high' },
    { title: 'Diabetic', severity: 'medium' },
  ],
  parentLinks: [
    {
      role: 'CO_PARENT',
      status: 'ACTIVE',
      parent: { firstName: 'Ada', lastName: 'Whitfield' },
    },
  ],
};

/**
 * The record a companion is actually registered with: a name, a species, and
 * nothing else. Every optional field the overview draws is missing, which is the
 * branch that decides whether the panel prints a dash or a stale value - and
 * whether the red allergy emphasis fires on a record with no allergy.
 */
const SPARSE_COMPANION: CompanionWithLinks = {
  id: COMPANION_ID,
  organisationId: ORG_ID,
  parentId: PARENT_ID,
  name: 'Poppy Hartmann',
  type: 'dog',
  breed: '',
  dateOfBirth: COMPANION_DOB,
  gender: 'female',
  isInsured: false,
  status: 'active',
};

const FULL_PARENT: StoredParent = {
  id: PARENT_ID,
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+49 30 555 0134',
  birthDate: PARENT_DOB,
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
  alerts: [{ title: 'Call before visit', severity: 'low' }],
};

const SPARSE_PARENT: StoredParent = {
  id: PARENT_ID,
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const booking = (id: string, start: Date, status: Appointment['status']): Appointment => ({
  id,
  organisationId: ORG_ID,
  patient: {
    id: COMPANION_ID,
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: PARENT_ID, name: 'Lena Hartmann' },
  },
  appointmentDate: start,
  startTime: start,
  endTime: new Date(start.getTime() + 30 * 60_000),
  timeSlot: '30',
  durationMinutes: 30,
  status,
});

/**
 * One visit already behind us and one still ahead. "Last visit" on this page is
 * the Companions directory's definition - the most recent appointment that has
 * ALREADY STARTED - so a panel that simply took the newest appointment would
 * print the future booking and look perfectly plausible.
 */
const APPOINTMENTS: Appointment[] = [
  booking('appt-past', PAST_VISIT, 'COMPLETED'),
  booking('appt-future', FUTURE_VISIT, 'UPCOMING'),
];

const HISTORY_ENTRIES: HistoryEntry[] = [
  {
    id: 'history-appointment-1',
    type: 'APPOINTMENT',
    occurredAt: PAST_VISIT.toISOString(),
    status: 'completed',
    title: 'Annual wellness exam',
    subtitle: 'Consult 2 - 30 minutes',
    actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
    link: { kind: 'appointment', id: 'appt-past', companionId: COMPANION_ID },
    source: 'appointments',
    payload: {},
  },
  {
    id: 'history-lab-1',
    type: 'LAB_RESULT',
    occurredAt: PAST_VISIT.toISOString(),
    status: 'COMPLETED',
    title: 'Complete blood count',
    subtitle: 'IDEXX ProCyte Dx',
    actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
    link: { kind: 'labResult', id: 'lab-1' },
    source: 'idexx',
    payload: {},
  },
];

const TERMINOLOGY_KEYS = ['yc_companion_terminology_by_org', 'yc_companion_terminology_pending'];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse =>
  ({ data, status: 200, statusText: 'OK', headers: config.headers, config }) as AxiosResponse;

/**
 * The passport is answered with a number derived from the companion id in the
 * REQUESTED path rather than from a constant. That is what makes the passport
 * story able to say which record the page asked for: the modal takes its title
 * from a prop and its body from this call, so a page that passed the wrong id
 * would still be headed "Poppy's passport".
 */
const buildPassport = (url: string): PetPassportDTO => {
  const requestedId = /\/companion\/([^/]+)\/passport/.exec(url)?.[1] ?? 'unknown';
  return {
    identity: {
      id: requestedId,
      name: 'Poppy Hartmann',
      species: 'dog',
      breed: 'Beagle',
      sex: 'female',
      colour: 'Tricolour',
    },
    passportNumber: `PASSPORT-FOR-${requestedId}`,
    vaccinations: [],
    parasiteTreatments: [],
    rabiesTitrations: [],
    clinicalExams: [],
  };
};

type PrepareOptions = {
  permissions?: string[];
  orgType?: Organisation['type'];
  /** 'sparse' swaps in the record whose optional fields are all missing. */
  record?: 'full' | 'sparse';
  /** 'loading' holds the page on the shared page skeleton. */
  companionStatus?: 'loading' | 'loaded';
};

/**
 * The whole route, offline.
 *
 * `CompanionHistoryPage` exports only the guarded default, so every story here
 * renders through the real ProtectedRoute + OrgGuard rather than around them.
 * That is not free: OrgGuard mounts eleven org-scoped loaders, so each of their
 * stores is seeded with an entry for this org (they all short-circuit on
 * `Object.hasOwn(...ByOrgId, primaryOrgId)`), and the shared axios instance gets
 * an adapter that answers from fixtures. The history call in particular has to
 * return a well-formed envelope: the timeline `console.error`s an invalid one,
 * and the story verifier counts a console error as a failure.
 *
 * The guard data itself is real rather than bypassed - an authenticated session,
 * a verified org, an active membership, a profile past onboarding step 3 and one
 * availability row. Miss any of those and the guard throws Next's redirect
 * instead of rendering.
 */
const prepare =
  ({
    permissions = FULL_ACCESS,
    orgType = 'HOSPITAL',
    record = 'full',
    companionStatus = 'loaded',
  }: PrepareOptions = {}) =>
  () => {
    const snapshots = {
      appointment: useAppointmentStore.getState(),
      auth: useAuthStore.getState(),
      availability: useAvailabilityStore.getState(),
      companion: useCompanionStore.getState(),
      document: useOrganizationDocumentStore.getState(),
      forms: useFormsStore.getState(),
      integration: useIntegrationStore.getState(),
      inventory: useInventoryStore.getState(),
      invoice: useInvoiceStore.getState(),
      org: useOrgStore.getState(),
      parent: useParentStore.getState(),
      profile: useUserProfileStore.getState(),
      room: useOrganisationRoomStore.getState(),
      routeLoader: useRouteLoaderStore.getState(),
      speciality: useSpecialityStore.getState(),
      task: useTaskStore.getState(),
      team: useTeamStore.getState(),
    };

    /* The companion noun is resolved from the org type AND from localStorage, so
       a value another story left behind would rename every label on this page. */
    const storageSnapshot = TERMINOLOGY_KEYS.map(
      (key) => [key, globalThis.localStorage.getItem(key)] as const
    );
    for (const [key] of storageSnapshot) globalThis.localStorage.removeItem(key);

    const originalAdapter = api.defaults.adapter;

    /* An empty LIST is the default answer, not an empty object: several services
       the mounted overlays reach for spread the response straight into an array,
       where `{}` is a TypeError rather than "no data". The named branches below
       are the calls whose SHAPE this page depends on. */
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      const url = String(config.url ?? '');
      if (url.includes('/v1/companion-history/')) {
        return Promise.resolve(
          respond(config, {
            entries: HISTORY_ENTRIES,
            nextCursor: null,
            summary: { totalReturned: HISTORY_ENTRIES.length, countsByType: {} },
          })
        );
      }
      if (url.includes('/passport')) {
        return Promise.resolve(respond(config, buildPassport(url)));
      }
      if (url.includes('/shares')) {
        return Promise.resolve(respond(config, { tokens: [] }));
      }
      if (url.includes('/v1/audit-trail/')) {
        return Promise.resolve(respond(config, { entries: [] }));
      }
      if (url.includes('/v1/finance/usage-snapshots')) {
        return Promise.resolve(respond(config, { data: [] }));
      }
      if (url.includes('/v1/finance/')) {
        return Promise.resolve(respond(config, { data: {} }));
      }
      return Promise.resolve(respond(config, []));
    }) as AxiosAdapter;

    const companion = record === 'sparse' ? SPARSE_COMPANION : FULL_COMPANION;
    const parent = record === 'sparse' ? SPARSE_PARENT : FULL_PARENT;
    const emptyIndex = { [ORG_ID]: [] as string[] };
    const fetchedAt = { [ORG_ID]: new Date().toISOString() };

    useAuthStore.setState({ status: 'authenticated' });
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: buildOrg(orgType) },
      membershipsByOrgId: { [ORG_ID]: membership(permissions) },
      status: 'loaded',
    });
    useUserProfileStore.setState({ profilesByOrgId: { [ORG_ID]: PROFILE }, status: 'loaded' });
    useAvailabilityStore.setState({
      availabilitiesById: { [AVAILABILITY._id]: AVAILABILITY },
      availabilityIdsByOrgId: { [ORG_ID]: [AVAILABILITY._id] },
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: { [companion.id]: companion },
      companionsIdsByOrgId: { [ORG_ID]: [companion.id] },
      status: companionStatus,
    });
    useParentStore.setState({ parentsById: { [parent.id]: parent } });
    useAppointmentStore.setState({
      appointmentsById: Object.fromEntries(APPOINTMENTS.map((item) => [item.id as string, item])),
      appointmentIdsByOrgId: { [ORG_ID]: APPOINTMENTS.map((item) => item.id as string) },
      status: 'loaded',
    });
    useTeamStore.setState({ teamIdsByOrgId: emptyIndex, status: 'loaded' });
    useSpecialityStore.setState({ specialityIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganisationRoomStore.setState({ roomIdsByOrgId: emptyIndex, status: 'loaded' });
    useInvoiceStore.setState({ invoiceIdsByOrgId: emptyIndex, status: 'loaded' });
    useTaskStore.setState({ taskIdsByOrgId: emptyIndex, status: 'loaded' });
    useOrganizationDocumentStore.setState({ documentIdsByOrgId: emptyIndex, status: 'loaded' });
    useIntegrationStore.setState({ integrationIdsByOrgId: emptyIndex, status: 'loaded' });
    useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
    useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });

    return () => {
      api.defaults.adapter = originalAdapter;
      useTeamStore.setState(snapshots.team);
      useTaskStore.setState(snapshots.task);
      useSpecialityStore.setState(snapshots.speciality);
      useRouteLoaderStore.setState(snapshots.routeLoader);
      useOrganisationRoomStore.setState(snapshots.room);
      useUserProfileStore.setState(snapshots.profile);
      useParentStore.setState(snapshots.parent);
      useOrgStore.setState(snapshots.org);
      useInvoiceStore.setState(snapshots.invoice);
      useInventoryStore.setState(snapshots.inventory);
      useIntegrationStore.setState(snapshots.integration);
      useFormsStore.setState(snapshots.forms);
      useOrganizationDocumentStore.setState(snapshots.document);
      useCompanionStore.setState(snapshots.companion);
      useAvailabilityStore.setState(snapshots.availability);
      useAuthStore.setState(snapshots.auth);
      useAppointmentStore.setState(snapshots.appointment);
      for (const [key, value] of storageSnapshot) {
        if (value === null) globalThis.localStorage.removeItem(key);
        else globalThis.localStorage.setItem(key, value);
      }
    };
  };

/**
 * The label/value pairs inside one profile panel.
 *
 * `ProfileDetail` renders a two-track grid holding a `label:` span and a value
 * span, with no role, id or test hook to tie the two together - so the panel is
 * a flat run of anonymous divs whose ONLY relationship is their order. Swapping
 * two `details.find(...)` lookups in the page would move a value under someone
 * else's label and still render eleven plausible rows.
 */
const detailRows = (root: HTMLElement): Array<{ label: string; valueEl: HTMLElement }> => {
  const rows: Array<{ label: string; valueEl: HTMLElement }> = [];
  for (const row of root.querySelectorAll<HTMLElement>('div')) {
    if (row.children.length !== 2) continue;
    const [labelEl, valueEl] = Array.from(row.children) as HTMLElement[];
    if (labelEl.tagName !== 'SPAN' || valueEl.tagName !== 'SPAN') continue;
    const label = (labelEl.textContent ?? '').trim();
    if (!label.endsWith(':')) continue;
    rows.push({ label: label.slice(0, -1), valueEl });
  }
  return rows;
};

const readDetails = (root: HTMLElement): Record<string, string> =>
  Object.fromEntries(
    detailRows(root).map((row) => [row.label, (row.valueEl.textContent ?? '').trim()])
  );

const detailValueEl = (root: HTMLElement, label: string): HTMLElement => {
  const row = detailRows(root).find((candidate) => candidate.label === label);
  if (!row) throw new Error(`No "${label}" row in this panel.`);
  return row.valueEl;
};

/** Both profile panels are `<section aria-label>`, so they expose a named region. */
const panels = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    companion: canvas.getByRole('region', { name: 'Companion profile' }),
    parent: canvas.getByRole('region', { name: 'Parent profile' }),
  };
};

/**
 * Every overlay on this page portals to document.body, outside `canvasElement`.
 *
 * The opacity is polled, not just the `open` attribute. `AddAlertModal` and the
 * booking modal are mounted at all times and fade in from `opacity-0` over
 * 100ms, so they are `open` a frame before they are visible - reading their
 * contents on the same tick as the click fails `toBeVisible` on a dialog that is
 * perfectly healthy. The overlays that unmount when closed (share card, pet
 * passport) mount at full opacity and settle immediately.
 */
const openedDialog = async (): Promise<HTMLElement> =>
  waitFor(() => {
    const nodes = globalThis.document.querySelectorAll<HTMLElement>('dialog[open]');
    expect(nodes).toHaveLength(1);
    expect(getComputedStyle(nodes[0]).opacity).toBe('1');
    return nodes[0];
  });

const noOpenDialog = async () =>
  waitFor(() => {
    expect(globalThis.document.querySelectorAll('dialog[open]')).toHaveLength(0);
  });

const meta = {
  title: 'CompanionHistory/CompanionHistoryPage',
  component: CompanionHistoryPage,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname; the page reads companionId / source / backTo
    // off useSearchParams and pushes with useRouter.
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/companions/history',
        query: { companionId: COMPANION_ID, source: 'companions' },
      },
    },
    docs: {
      description: {
        component:
          'The companion overview at `/companions/history`, rendered through the guards it ships ' +
          'behind rather than around them. It assembles a title row, two profile panels, four ' +
          'overlays and the lazily imported history timeline on top of a record it looks up by ' +
          'query parameter.\n\n' +
          '**The record is found by `companionId`, and the page has two failure modes for it.** ' +
          'With no id at all it prints an inline notice and drops the timeline - but it still ' +
          'offers Add appointment, so the booking modal opens on a page that has just said it does ' +
          'not know which patient this is. With an id that matches nothing the notice never ' +
          'appears: `hasCompanionId` is true, so the profile panels simply do not render and the ' +
          'timeline queries an id the org does not own.\n\n' +
          '**Every noun on the page tracks the org.** `useCompanionTerminologyText` rewrites the ' +
          'ID row label, the fallback title and both edit/alert aria-labels, so a hospital reads ' +
          '"Patient ID" and "Add patient alert" while a boarding facility reads "Companion ID" and ' +
          '"Add companion alert" from the same source strings. The client alert button is the one ' +
          'that is NOT rewritten.\n\n' +
          '**Two dashed circles sit on the same screen and mean different things.** The one beside ' +
          'the title adds a patient alert, the one in the parent panel adds a client alert; they ' +
          'are the same 24px control with the same icon and they write to different records.\n\n' +
          '**"Dues cleared" is hard-coded.** The green pill in the parent panel is a literal, not a ' +
          'balance - every client on every record is reported as settled.\n\n' +
          '**Back is a computed path, not history.** `resolveSafeBackPath` rejects a ' +
          'protocol-relative `backTo`, falls back to /appointments or /companions by `source`, and ' +
          'strips a `companionId` deep link out of a /companions return path so Back cannot replay ' +
          'the link that opened this page.\n\n' +
          'Every store the guards and the page read is seeded and the shared axios adapter answers ' +
          'from fixtures, so no story here touches the network - but the org guard, the permission ' +
          'gate, the terminology rewriter and the dynamic timeline import all run for real.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: prepare(),
} satisfies Meta<typeof CompanionHistoryPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  name: 'Loaded record',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Qualified by name as well as level: the preview decorator injects its own
       sr-only `<h1>` carrying the story title, so `level: 1` alone is ambiguous. */
    await expect(
      await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" })
    ).toBeVisible();

    const { companion, parent } = panels(canvasElement);
    const companionDetails = readDetails(companion);

    /* Order as well as content. The eleven rows are assembled by eleven separate
       `details.find(...)` lookups against a shared list, so a reordered or
       mis-targeted lookup produces a full, plausible panel with one value under
       the wrong label. */
    await expect(Object.keys(companionDetails)).toEqual([
      'Name',
      'Patient ID',
      'Breed/Species',
      'Age / DOB',
      'Sex',
      'Weight',
      'Blood Group',
      'Microchip ID',
      'Allergies',
      'Insurance',
      'Last visit',
    ]);
    await expect(companionDetails.Name).toBe('Poppy Hartmann');
    await expect(companionDetails['Patient ID']).toBe(COMPANION_ID);
    await expect(companionDetails['Breed/Species']).toBe('Beagle / Canine');
    await expect(companionDetails.Sex).toBe('Female, Spayed');
    await expect(companionDetails.Weight).toBe('11.4 kg');
    await expect(companionDetails['Microchip ID']).toBe('981020034512789');
    // Age is derived from the clock, so only the years half is pinned - the date
    // half is whatever the shared formatter prints in the runner's timezone.
    await expect(companionDetails['Age / DOB']).toMatch(/^4 years \/ .+/);

    /* Insurance reads company AND cover state in one row. The company alone
       would be a claim the record has not made: `formatInsurance` only appends
       "· active" when the policy (or the flag) says the cover is live. */
    await expect(companionDetails.Insurance).toBe('PetSecure · active');

    /* Last visit is the most recent appointment that has ALREADY STARTED. The
       org owns one visit ten days back and one booking five days out, and the
       future one must not win - a panel that took the newest appointment would
       tell the vet the patient was last seen next week. */
    await expect(companionDetails['Last visit']).toBe(formatDisplayDate(PAST_VISIT, '-'));
    await expect(companionDetails['Last visit']).not.toBe(formatDisplayDate(FUTURE_VISIT, '-'));

    const parentDetails = readDetails(parent);
    await expect(Object.keys(parentDetails)).toEqual([
      'Client',
      'Email',
      'Age / DOB',
      'Phone',
      'Client ID',
      'Co-parent',
    ]);
    await expect(parentDetails.Client).toBe('Lena Hartmann');
    await expect(parentDetails['Client ID']).toBe(PARENT_ID);
    /* The co-parent row only exists when a live CO_PARENT link does, and it
       carries the "· shared care" qualifier in the same span as the name. */
    await expect(parentDetails['Co-parent']).toBe('Ada Whitfield · shared care');

    /* Allergies are painted in --danger-text rather than --ink. Read as computed
       colour against a neighbouring row, not as a class: the tone is applied
       through an inline style off a value comparison, so the class list says
       nothing about whether it fired. */
    await expect(getComputedStyle(detailValueEl(companion, 'Allergies')).color).not.toBe(
      getComputedStyle(detailValueEl(companion, 'Name')).color
    );

    // Stored alerts reach the title row and the parent panel through two
    // different mappers, keyed by different prefixes.
    await expect(canvas.getByText('Needs muzzle')).toBeVisible();
    await expect(canvas.getByText('Diabetic')).toBeVisible();
    await expect(within(parent).getByText('Call before visit')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Remove alert Needs muzzle' })).toBeVisible();

    /* Hard-coded, not computed. Every parent panel says the account is settled,
       whatever the ledger holds. */
    await expect(within(parent).getByText('Dues cleared')).toBeVisible();

    // The header actions, by accessible name. Note that the passport button's
    // tooltip ("Pet passport") and its label do not match.
    await expect(canvas.getByRole('button', { name: 'Go back' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Share companion card' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Open pet passport' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add appointment' })).toBeVisible();
    /* Sourced from 'Add companion alert' and rewritten by the org's noun, which
       is why a hospital reads "patient" on a string the code spells "companion". */
    await expect(canvas.getByRole('button', { name: 'Add patient alert' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Edit patient details' })).toBeVisible();

    /* The timeline is a `next/dynamic` import behind a pulsing placeholder, so
       this is the assertion that says the chunk resolved and was handed the
       companion the panels are describing. */
    await expect(await canvas.findByText('Annual wellness exam')).toBeVisible();
  },
};

export const SparseRecord: Story = {
  name: 'Newly registered record',
  beforeEach: prepare({ record: 'sparse' }),
  parameters: {
    docs: {
      description: {
        story:
          'A record with only the fields registration demands. The panel keeps its full height and ' +
          'its full row count - nothing is hidden - so the reader gets a grid of dashes rather ' +
          'than a shorter card, and the two rows that are NOT dashes are the ones a missing value ' +
          'is spelled differently in: Insurance collapses an uninsured record to a bare dash, and ' +
          'Sex drops the neuter qualifier instead of guessing at it.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });

    const { companion, parent } = panels(canvasElement);
    const companionDetails = readDetails(companion);

    await expect(companionDetails['Blood Group']).toBe('-');
    await expect(companionDetails['Microchip ID']).toBe('-');
    await expect(companionDetails.Allergies).toBe('-');
    await expect(companionDetails.Weight).toBe('-');
    /* No company and `isInsured: false`, so the row is a dash rather than the
       word "Active" - the branch that decides whether the page states a cover
       status it has no policy for. */
    await expect(companionDetails.Insurance).toBe('-');
    /* `isneutered` is absent, not false: the qualifier is dropped rather than
       rendered as "Female, Entire", which would be a clinical claim. */
    await expect(companionDetails.Sex).toBe('Female');
    // No appointments removed, so Last visit still resolves - a sparse RECORD is
    // not a patient with no history.
    await expect(companionDetails['Last visit']).toBe(formatDisplayDate(PAST_VISIT, '-'));

    /* The red emphasis is conditional on the VALUE, not on the label. With no
       allergy on file the row has to fall back to --ink, or a dash reads as a
       warning. */
    await expect(getComputedStyle(detailValueEl(companion, 'Allergies')).color).toBe(
      getComputedStyle(detailValueEl(companion, 'Name')).color
    );

    // No parent birth date and no phone: both dash, and the panel loses the
    // co-parent row entirely rather than printing an empty one.
    const parentDetails = readDetails(parent);
    await expect(parentDetails['Age / DOB']).toBe('-');
    await expect(parentDetails.Phone).toBe('-');
    await expect(Object.keys(parentDetails)).not.toContain('Co-parent');

    // No stored alerts, so both alert rails are empty - but the two add
    // affordances stay, because they are gated on the record, not on the alerts.
    await expect(canvas.queryByText('Needs muzzle')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add patient alert' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add client alert' })).toBeVisible();
  },
};

export const AlertTargets: Story = {
  name: 'Patient alert vs client alert',
  parameters: {
    docs: {
      description: {
        story:
          'The two dashed circles are the same control drawn twice: same size, same icon, same ' +
          'hover treatment, one beside the title and one in the parent panel. They write to ' +
          'different records through different services, and the only thing on screen that says ' +
          'so is the copy inside the modal they open - which is why this is worth a play function ' +
          'rather than a screenshot.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });
    await noOpenDialog();

    await userEvent.click(canvas.getByRole('button', { name: 'Add patient alert' }));
    const patientDialog = await openedDialog();

    /* The heading and the body line together. The heading alone is "Add alert"
       on the patient side and "Add client alert" on the client side, but the
       body is what names the subject - and it addresses the patient by FIRST
       name while the client side uses the full name. */
    await expect(within(patientDialog).getByRole('heading', { level: 2 }).textContent).toBe(
      'Add alert'
    );
    await expect(
      within(patientDialog).getByText('Add a clinical or behavioural alert for Poppy.')
    ).toBeVisible();
    await expect(
      within(patientDialog).getByText('Alert (e.g. Needs muzzle, Diabetic)')
    ).toBeVisible();

    /* No accessible name at all. `CenterModal` accepts both `ariaLabel` and
       `ariaLabelledBy` and `AddAlertModal` passes neither, so the dialog it
       renders is announced as an unnamed dialog even though it has a visible
       `<h2>` two nodes down. */
    await expect(patientDialog.getAttribute('aria-label')).toBeNull();
    await expect(patientDialog.getAttribute('aria-labelledby')).toBeNull();

    await userEvent.click(within(patientDialog).getByRole('button', { name: 'Cancel' }));
    await noOpenDialog();

    await userEvent.click(canvas.getByRole('button', { name: 'Add client alert' }));
    const clientDialog = await openedDialog();

    await expect(within(clientDialog).getByRole('heading', { level: 2 }).textContent).toBe(
      'Add client alert'
    );
    await expect(
      within(clientDialog).getByText('Add a client alert for Lena Hartmann.')
    ).toBeVisible();
    await expect(
      within(clientDialog).getByText('Alert (e.g. Call before visit, Billing follow-up)')
    ).toBeVisible();
    // The patient copy must be gone rather than merely joined: a modal that
    // opened on the wrong target would still satisfy a "the dialog is open" check.
    await expect(
      within(clientDialog).queryByText('Add a clinical or behavioural alert for Poppy.')
    ).not.toBeInTheDocument();
  },
};

export const AddAppointment: Story = {
  name: 'Booking from the record',
  parameters: {
    docs: {
      description: {
        story:
          'The booking modal is handed `initialCompanionId` and auto-selects it on open, so the ' +
          'reader books for the patient they were already looking at instead of searching for them ' +
          'again. Selecting the patient then resolves the client, which is what the notification ' +
          'line at the foot of the form is addressed to.\n\n' +
          'The prefill is the only thing tying the two screens together - this is the same ' +
          'component the Appointments board opens cold - and nothing on screen announces it, so a ' +
          'broken hand-off looks exactly like a fresh booking form.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });
    await noOpenDialog();

    await userEvent.click(canvas.getByRole('button', { name: 'Add appointment' }));
    const dialog = await openedDialog();

    // The modal keeps its own generic title - it never names the patient - so
    // the two fields below are the whole of the evidence for the hand-off.
    await expect(within(dialog).getByText('New appointment')).toBeVisible();

    /* Read off the input's VALUE, not off the chip beside it: the chip is an
       `aria-hidden` initials disc, so "PH" is all a text query could find and
       any two-word name would satisfy it. The label is the org's noun, so this
       field is called "Patient" here and "Companion" at a boarding facility. */
    await waitFor(async () => {
      await expect(within(dialog).getByRole('textbox', { name: 'Patient' })).toHaveValue(
        'Poppy Hartmann · Hartmann'
      );
    });

    /* The client is derived from the patient rather than chosen, and it is the
       one the confirmation email goes to - so a wrong or empty value here is a
       booking confirmation sent to nobody. */
    await expect(within(dialog).getByRole('textbox', { name: 'Client' })).toHaveValue(
      'Lena Hartmann'
    );
    await expect(within(dialog).getByText('Lena will be notified by push + email')).toBeVisible();
  },
};

export const ReadOnly: Story = {
  name: 'View-only permissions',
  beforeEach: prepare({ permissions: [PERMISSIONS.COMPANIONS_VIEW_ANY] }),
  parameters: {
    docs: {
      description: {
        story:
          'Without `companions:edit:any` the record is fully readable and the editor is not merely ' +
          'disabled - the pencil is not rendered and the edit modal is never mounted, so there is ' +
          'no trace that editing exists. Everything else survives: alerts can still be added and ' +
          'removed, appointments can still be booked, and the card and passport can still be ' +
          'shared, none of which is gated on the edit grant.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });

    // The record reads in full - the missing grant removes ways to change it,
    // not ways to see it.
    await expect(Object.keys(readDetails(panels(canvasElement).companion))).toHaveLength(11);

    await expect(
      canvas.queryByRole('button', { name: 'Edit patient details' })
    ).not.toBeInTheDocument();

    /* Not just hidden: `CompanionHistoryModals` gates the whole editor subtree on
       the same grant, so nothing that could be opened by another route into the
       page state is in the DOM either. */
    await expect(canvas.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();

    // Untouched by the edit grant, which is the half of this worth pinning:
    // a permission check pasted one level too high would take these with it.
    await expect(canvas.getByRole('button', { name: 'Add patient alert' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add appointment' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Share companion card' })).toBeVisible();
  },
};

export const MissingCompanionId: Story = {
  name: 'Opened without a companion id',
  parameters: {
    nextjs: {
      appDirectory: true,
      /* Blanked, not omitted. Storybook merges parameters DEEPLY, so a story
         that simply leaves `query` out inherits the meta's `companionId` and
         renders the loaded record while claiming to draw the empty one - which
         is exactly how this story first passed. Empty strings reach the page as
         the same falsy values a missing parameter would. */
      navigation: { pathname: '/companions/history', query: { companionId: '', source: '' } },
    },
    docs: {
      description: {
        story:
          'The page reached directly, with no query at all. It is the only state that explains ' +
          'itself in words - and it still offers the primary action, so Add appointment opens the ' +
          'booking modal on a page that has just said it does not know which patient this is.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The fallback title is the rewritten noun, not the record name: with a
    // hospital org "Companion overview" is announced as "Patient overview".
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Patient overview' })
    ).toBeVisible();
    await expect(
      canvas.getByText(
        'Companion id is missing. Please open overview from Appointments or Companions.'
      )
    ).toBeVisible();

    // Both panels and the timeline are gone: one is gated on the record, the
    // other on the id, and this state has neither.
    await expect(
      canvas.queryByRole('region', { name: 'Companion profile' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('region', { name: 'Parent profile' })).not.toBeInTheDocument();
    await expect(canvas.queryByText('Annual wellness exam')).not.toBeInTheDocument();

    // Every record-scoped affordance goes with them...
    await expect(
      canvas.queryByRole('button', { name: 'Share companion card' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Open pet passport' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Add patient alert' })
    ).not.toBeInTheDocument();

    /* ...except Add appointment, which is rendered unconditionally. It is the
       one control on this screen that contradicts the notice above it. */
    await expect(canvas.getByRole('button', { name: 'Add appointment' })).toBeVisible();
  },
};

export const Loading: Story = {
  name: 'Companions still loading',
  beforeEach: prepare({ companionStatus: 'loading' }),
  parameters: {
    docs: {
      description: {
        story:
          'While the companion store is loading the page returns the shared list skeleton from ' +
          'inside both guards rather than drawing an empty record. That matters more here than on ' +
          'a list: a half-built overview would show the title row, the two empty panels and the ' +
          'header actions over a patient it has not found yet, and every dash in it would read as ' +
          'a fact about the record.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() =>
      expect(canvasElement.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    );

    /* Nothing interactive leaks through. Asserting the absence of the controls
       rather than the presence of the shimmer is the half that would catch a
       skeleton rendered NEXT TO a half-built page instead of instead of it. */
    await expect(canvas.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Add appointment' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('region', { name: 'Companion profile' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText(/overview$/)).not.toBeInTheDocument();
    // The record notice is not the loading state either - "missing" and "not
    // arrived yet" are different claims and only one of them is true here.
    await expect(canvas.queryByText(/Companion id is missing/)).not.toBeInTheDocument();
  },
};

export const BackFromAppointments: Story = {
  name: 'Back rejects an unsafe backTo',
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/companions/history',
        query: {
          companionId: COMPANION_ID,
          source: 'appointments',
          // Protocol-relative: it starts with '/' like any in-app path, so a
          // naive "is it absolute" check lets it through and Back leaves the app.
          backTo: '//evil.example/phish',
        },
      },
    },
    docs: {
      description: {
        story:
          'Back is a computed destination, not browser history. `resolveSafeBackPath` refuses a ' +
          'protocol-relative `backTo` - which is an off-site URL wearing a leading slash - and ' +
          'falls back to the board named by `source`. Both halves are asserted: the route loader ' +
          'has to start BEFORE the push, or the reader gets a blank frame while /appointments ' +
          'boots, and a test that only checked the push would pass with that call deleted.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });

    await expect(useRouteLoaderStore.getState().isLoading).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Go back' }));

    await expect(getRouter().push).toHaveBeenCalledWith('/appointments');
    await expect(getRouter().push).not.toHaveBeenCalledWith('//evil.example/phish');
    await expect(useRouteLoaderStore.getState().isLoading).toBe(true);
  },
};

export const BackFromCompanions: Story = {
  name: 'Back drops the deep link it arrived on',
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/companions/history',
        query: {
          companionId: COMPANION_ID,
          source: 'companions',
          backTo: `/companions?view=grid&companionId=${COMPANION_ID}`,
        },
      },
    },
    docs: {
      description: {
        story:
          'The directory builds this `backTo` from its own URL, which may still carry the ' +
          '`companionId` that opened the record. Returning to it verbatim would re-fire the deep ' +
          'link and pop the record straight back open over the list the reader was trying to get ' +
          'to. The strip is scoped: only `companionId` is removed, and only when the return path ' +
          'is /companions, so an unrelated query survives.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });

    await userEvent.click(canvas.getByRole('button', { name: 'Go back' }));

    await expect(getRouter().push).toHaveBeenCalledWith('/companions?view=grid');
    await expect(useRouteLoaderStore.getState().isLoading).toBe(true);
  },
};

export const ShareCard: Story = {
  name: 'Share companion card',
  parameters: {
    docs: {
      description: {
        story:
          'The staff card is assembled client-side from the record already on screen - it is a ' +
          'projection, not a fetch - so the two views of the same companion sit one modal apart ' +
          'and can be compared directly. They do not agree: the page prints the weight as ' +
          '"11.4 kg" and the card labels the same number "Weight (lbs)".',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });

    const pageWeight = readDetails(panels(canvasElement).companion).Weight;
    await expect(pageWeight).toBe('11.4 kg');

    await userEvent.click(canvas.getByRole('button', { name: 'Share companion card' }));
    const dialog = await openedDialog();

    // Titled from the FIRST word of the record name, so a two-part name does not
    // run the header into an ellipsis.
    await expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      "Share Poppy's card"
    );

    /* The card is built by `buildStaffCard` from the loaded record, so every row
       in it is a second rendering of data the panel behind it already showed.
       Microchip and passport come straight across. */
    await expect(within(dialog).getByText('981020034512789')).toBeVisible();
    await expect(within(dialog).getByText('GB-2026-004471')).toBeVisible();

    /* The unit disagreement, read as a pair. `companion.currentWeight` is
       kilograms everywhere else in the app - `formatWeight` appends " kg" - and
       the card prints the bare number under a pounds label, so the same record
       states two different weights depending on which surface it is read from. */
    const weightRow = within(dialog).getByText('Weight (lbs)').parentElement as HTMLElement;
    await expect(weightRow.textContent).toBe('Weight (lbs)11.4');

    // The alerts travel with the card, so a "needs muzzle" warning is not left
    // behind when the record is handed to someone else.
    await expect(within(dialog).getByText('Needs muzzle')).toBeVisible();
    // No live share link exists yet, so the sheet offers to mint one rather than
    // showing a QR for a token that was never issued.
    await expect(
      within(dialog).getByRole('button', { name: 'Create shareable card link' })
    ).toBeVisible();
  },
};

export const PetPassport: Story = {
  name: 'Pet passport',
  parameters: {
    docs: {
      description: {
        story:
          'Unlike the share card, the passport is fetched: the modal takes its title from a prop ' +
          'and its body from the API. That split is what this story pins - the passport number ' +
          'below is minted from the companion id in the REQUESTED path, so a page that titled the ' +
          'sheet correctly while asking for the wrong record would still be caught.\n\n' +
          'The wallet buttons are absent on purpose. A pass embeds a public share link in its QR ' +
          'and staff cannot mint that link, so the sheet says what is missing instead of offering ' +
          'an action that can only fail.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });

    await userEvent.click(canvas.getByRole('button', { name: 'Open pet passport' }));
    const dialog = await openedDialog();

    await expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      "Poppy's passport"
    );

    /* The number the fixture derives from the requested path. Asserting it is
       how this story says the page passed `activeCompanion.companion.id` rather
       than the parent id or the raw query string. */
    await expect(await within(dialog).findByText(`PASSPORT-FOR-${COMPANION_ID}`)).toBeVisible();

    // Issuance is the gate. Nothing has been issued, so neither wallet button is
    // offered and the sheet explains which step is outstanding.
    await expect(
      within(dialog).getByText('Wallet passes become available once a vet issues this passport.')
    ).toBeVisible();
    await expect(
      within(dialog).queryByRole('button', { name: 'Add to Apple Wallet' })
    ).not.toBeInTheDocument();
  },
};

export const BoarderTerminology: Story = {
  name: 'Boarding facility vocabulary',
  beforeEach: prepare({ orgType: 'BOARDER' }),
  parameters: {
    docs: {
      description: {
        story:
          'The same record under an org whose noun is "companion". Five strings on this page run ' +
          'through `useCompanionTerminologyText`, and they are not spelled consistently in the ' +
          'source: the ID row and the edit control are written as "patient", the title-row alert ' +
          'control is written as "companion", and the rewriter lands all of them on the org\'s ' +
          'noun anyway. The client alert button is the odd one out - it is a literal, so it reads ' +
          '"Add client alert" whatever the org is called.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: "Poppy's overview" });

    // "Patient ID" in the source, rewritten by the org's noun.
    const companionDetails = readDetails(panels(canvasElement).companion);
    await expect(Object.keys(companionDetails)).toContain('Companion ID');
    await expect(Object.keys(companionDetails)).not.toContain('Patient ID');
    await expect(companionDetails['Companion ID']).toBe(COMPANION_ID);

    /* Both aria-labels move, from opposite source spellings: 'Edit patient
       details' and 'Add companion alert' end up on the same noun. */
    await expect(canvas.getByRole('button', { name: 'Edit companion details' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add companion alert' })).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Edit patient details' })
    ).not.toBeInTheDocument();

    // Not rewritten: the client is a person, not a patient, so this one is a
    // literal in the source and has to stay put.
    await expect(canvas.getByRole('button', { name: 'Add client alert' })).toBeVisible();
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert, and this branch is a `useIsPhone` media query
  // rather than a CSS breakpoint - at any wider width the desktop body renders.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below 768px the whole overview is replaced rather than restyled: `PhoneCompanionRecord` ' +
          'is a different tree with a contextual header, a compact identity block, a tap-to-call ' +
          'parent card, a collapsible details drawer and a sticky Book appointment bar. The parent ' +
          'panel has no phone equivalent at all, so the client alerts survive only as the subtitle ' +
          'on the parent contact card, and there is no way to add or remove one from a phone.\n\n' +
          'Deliberately without a play function: `useIsPhone` reads a real `matchMedia`, so it ' +
          'needs the manager to resize the preview iframe. A headless run that loads `iframe.html` ' +
          'directly keeps the desktop width and would assert the desktop panels while claiming to ' +
          'check the phone record.',
      },
    },
  },
};
